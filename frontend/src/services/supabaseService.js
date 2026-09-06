import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getApiBaseUrl } from '../config';

// 1. User Login
export const apiLogin = async (username, passcode) => {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim())
      .eq('passcode', passcode.trim())
      .single();

    if (error || !data) {
      throw new Error('Invalid credentials');
    }

    return {
      user_id: data.id,
      username: data.username,
      email: data.email,
      display_name: data.display_name || data.username,
      avatar_url: data.avatar_url,
      bio: data.bio || 'Available for chat ✨',
    };
  }

  // Local FastAPI fallback
  const res = await fetch(`${getApiBaseUrl()}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passcode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
    throw new Error(err.detail || 'Login failed');
  }
  return await res.json();
};

// 2. Send OTP
export const apiSendOtp = async (email) => {
  const cleanEmail = email.strip ? email.strip().toLowerCase() : email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    // Check existing email
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: otpErr } = await supabase
      .from('otps')
      .upsert({ email: cleanEmail, otp: otpCode, expires_at: expiresAt });

    if (otpErr) {
      throw new Error(`Failed to generate verification code: ${otpErr.message}`);
    }

    console.log(`[SUPABASE OTP] Verification code for ${cleanEmail}: ${otpCode}`);

    return {
      message: `Verification code sent to ${cleanEmail}`,
      email: cleanEmail,
      dev_otp: otpCode, // For convenient testing
    };
  }

  // Local FastAPI fallback
  const res = await fetch(`${getApiBaseUrl()}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Send OTP failed' }));
    throw new Error(err.detail || 'Failed to send OTP');
  }
  return await res.json();
};

// 3. Register User
export const apiRegister = async ({ username, email, otp, passcode, display_name, bio, avatar_url }) => {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  if (isSupabaseConfigured()) {
    // Verify OTP unless test code 123456
    if (cleanOtp !== '123456') {
      const { data: otpRow } = await supabase
        .from('otps')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!otpRow) {
        throw new Error('No OTP requested for this email or OTP expired');
      }
      if (new Date(otpRow.expires_at).getTime() < Date.now()) {
        throw new Error('Verification code has expired. Please request a new one.');
      }
      if (otpRow.otp !== cleanOtp) {
        throw new Error('Incorrect verification code. Please check your email.');
      }
    }

    // Check username duplicate
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      throw new Error('Username is already taken');
    }

    const newUser = {
      username: cleanUsername,
      email: cleanEmail,
      passcode: passcode && passcode.trim() ? passcode.trim() : '1234',
      display_name: display_name && display_name.trim() ? display_name.trim() : cleanUsername,
      bio: bio && bio.trim() ? bio.trim() : 'Available for chat ✨',
      avatar_url: avatar_url || null,
    };

    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();

    if (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }

    // Clean up OTP
    await supabase.from('otps').delete().eq('email', cleanEmail);

    return {
      user_id: data.id,
      username: data.username,
      email: data.email,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      bio: data.bio,
    };
  }

  // Local FastAPI fallback
  const res = await fetch(`${getApiBaseUrl()}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, otp, passcode, display_name, bio, avatar_url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  return await res.json();
};

// 4. Fetch All Users
export const apiGetUsers = async () => {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('users').select('*');
    if (error || !data) return [];
    return data.map((u) => ({
      user_id: u.id,
      username: u.username,
      email: u.email,
      display_name: u.display_name || u.username,
      avatar_url: u.avatar_url,
      bio: u.bio || 'Available for chat ✨',
    }));
  }

  // Local FastAPI fallback
  try {
    const res = await fetch(`${getApiBaseUrl()}/users`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Fetch users error:', e);
  }
  return [];
};

// 5. Profile Update
export const apiUpdateProfile = async (profileData) => {
  if (isSupabaseConfigured()) {
    const { user_id, username, display_name, bio, avatar_url, passcode } = profileData;

    // Check duplicate username if changing
    if (username && username.trim()) {
      const newUname = username.trim();
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', newUname)
        .neq('id', user_id)
        .maybeSingle();

      if (existing) {
        throw new Error('Username is already taken by another account');
      }
    }

    const updates = {};
    if (username !== undefined) updates.username = username.trim();
    if (display_name !== undefined) updates.display_name = display_name.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (passcode !== undefined) updates.passcode = passcode.trim();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Profile update failed: ${error.message}`);
    }

    return {
      user_id: data.id,
      username: data.username,
      email: data.email,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      bio: data.bio,
    };
  }

  // Local FastAPI fallback
  const res = await fetch(`${getApiBaseUrl()}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Update failed' }));
    throw new Error(err.detail || 'Update failed');
  }
  return await res.json();
};

// 6. Fetch Messages History
export const apiGetMessages = async () => {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(200);

    if (error || !data) return [];
    return data.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      text_content: m.text_content,
      media_url: m.media_url,
      reactions: typeof m.reactions === 'string' ? JSON.parse(m.reactions) : m.reactions || {},
      timestamp: m.timestamp,
    }));
  }

  // Local FastAPI fallback
  try {
    const res = await fetch(`${getApiBaseUrl()}/messages`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Fetch messages error:', e);
  }
  return [];
};

// 7. Send Message
export const apiSendMessage = async (sender_id, text_content, media_url = null) => {
  if (isSupabaseConfigured()) {
    const newMsg = {
      sender_id,
      text_content: text_content || null,
      media_url: media_url || null,
      reactions: {},
    };

    const { data, error } = await supabase
      .from('messages')
      .insert([newMsg])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return {
      id: data.id,
      sender_id: data.sender_id,
      text_content: data.text_content,
      media_url: data.media_url,
      reactions: typeof data.reactions === 'string' ? JSON.parse(data.reactions) : data.reactions || {},
      timestamp: data.timestamp,
    };
  }

  // (FastAPI WebSocket sends chat messages directly in local mode)
  return null;
};

// 8. Toggle Reaction
export const apiReactMessage = async (message_id, user_id, emoji) => {
  if (isSupabaseConfigured()) {
    // Get existing message
    const { data: msg } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', message_id)
      .single();

    let reactionsDict = msg && msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : { ...msg.reactions }) : {};
    const userStr = String(user_id);

    if (reactionsDict[userStr] === emoji) {
      delete reactionsDict[userStr];
    } else {
      reactionsDict[userStr] = emoji;
    }

    const { error } = await supabase
      .from('messages')
      .update({ reactions: reactionsDict })
      .eq('id', message_id);

    if (error) {
      console.error('Failed to react:', error);
    }
    return reactionsDict;
  }

  // Local FastAPI fallback
  const res = await fetch(`${getApiBaseUrl()}/messages/${message_id}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, emoji }),
  });
  if (res.ok) return await res.json();
  return null;
};

// 9. Clear All Messages
export const apiClearMessages = async () => {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('messages').delete().neq('id', -1);
    if (error) {
      console.error('Failed to clear messages:', error);
    }
    return { status: 'success' };
  }

  // Local FastAPI fallback
  const res = await fetch(`${getApiBaseUrl()}/messages`, { method: 'DELETE' });
  if (res.ok) return await res.json();
  return { status: 'failed' };
};

// 10. File Upload (Supabase Storage / Local API)
export const apiUploadFile = async (file) => {
  if (isSupabaseConfigured()) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `chat_uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat_media')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat_media')
      .getPublicUrl(filePath);

    return { media_url: publicUrlData.publicUrl };
  }

  // Local FastAPI fallback
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${getApiBaseUrl()}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return await res.json();
};
