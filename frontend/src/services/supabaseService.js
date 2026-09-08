import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getApiBaseUrl } from '../config';

// 1. User Login
export const apiLogin = async (username, passcode) => {
  if (isSupabaseConfigured()) {
    const cleanUname = username.trim();
    const cleanPass = passcode.trim();

    // 1. Try case-insensitive match on username
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanUname)
      .eq('passcode', cleanPass)
      .maybeSingle();

    // 2. Alias fallback: If username typed is Chinni_is_buzy, srevarsha, or Srevarsha for user ID 2
    if (!data && (cleanUname.toLowerCase() === 'chinni_is_buzy' || cleanUname.toLowerCase() === 'srevarsha')) {
      const { data: user2 } = await supabase
        .from('users')
        .select('*')
        .eq('id', 2)
        .eq('passcode', cleanPass)
        .maybeSingle();

      if (user2) data = user2;
    }

    if (!data) {
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

const USER_PAIR_MAP = {
  1: 2, // venkattejaa -> srevarsha
  2: 1, // srevarsha -> venkattejaa
  3: 4, // tester1 -> tester2
  4: 3, // tester2 -> tester1
};

// 6. Fetch Messages History (Isolated per conversation pair)
export const apiGetMessages = async (userId = null, partnerId = null) => {
  if (isSupabaseConfigured()) {
    const effectiveUserId = userId ? Number(userId) : null;
    const effectivePartnerId = partnerId ? Number(partnerId) : (effectiveUserId ? USER_PAIR_MAP[effectiveUserId] : null);

    let query = supabase
      .from('messages')
      .select('*')
      .not('text_content', 'like', 'USER_SETTING:%')
      .order('timestamp', { ascending: true })
      .limit(500);

    if (effectiveUserId && effectivePartnerId) {
      query = query.in('sender_id', [effectiveUserId, effectivePartnerId]);
    } else if (effectiveUserId) {
      query = query.or(`sender_id.eq.${effectiveUserId}`);
    }

    const { data, error } = await query;

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
export const apiSendMessage = async (sender_id, text_content, media_url = null, initialReactions = {}) => {
  if (isSupabaseConfigured()) {
    const newMsg = {
      sender_id,
      text_content: text_content || null,
      media_url: media_url || null,
      reactions: initialReactions || {},
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

// Mark Single Message as Seen
export const apiMarkSeen = async (message_id, user_id) => {
  if (isSupabaseConfigured()) {
    const { data: msg } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', message_id)
      .single();

    let rx = msg && msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : { ...msg.reactions }) : {};
    const userStr = String(user_id);
    if (!rx._seen) rx._seen = {};

    if (!rx._seen[userStr]) {
      rx._seen[userStr] = new Date().toISOString();
      await supabase
        .from('messages')
        .update({ reactions: rx })
        .eq('id', message_id);
    }
    return rx;
  }
  return null;
};

// Batch Mark Unread Partner Messages as Seen
export const apiMarkAllSeen = async (partnerSenderId, myUserId) => {
  if (isSupabaseConfigured() && partnerSenderId && myUserId) {
    const { data: partnerMsgs } = await supabase
      .from('messages')
      .select('id, reactions')
      .eq('sender_id', partnerSenderId);

    if (!partnerMsgs || partnerMsgs.length === 0) return;

    const myUserStr = String(myUserId);
    const nowIso = new Date().toISOString();

    for (const msg of partnerMsgs) {
      let rx = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : { ...msg.reactions }) : {};
      if (!rx._seen) rx._seen = {};
      if (!rx._seen[myUserStr]) {
        rx._seen[myUserStr] = nowIso;
        await supabase
          .from('messages')
          .update({ reactions: rx })
          .eq('id', msg.id);
      }
    }
  }
};

// 9. Clear Messages for current conversation pair only
export const apiClearMessages = async (userId = null, partnerId = null) => {
  if (isSupabaseConfigured()) {
    if (!userId || !partnerId) return { status: 'failed' };
    const { error } = await supabase
      .from('messages')
      .delete()
      .in('sender_id', [userId, partnerId])
      .not('text_content', 'like', 'USER_SETTING:%');
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
  if (!res.ok) {
    throw new Error('Upload failed');
  }
  return await res.json();
};

// 11. Mute Setting Persistence (Syncs across all devices & logins)
export const apiGetMuteSetting = async (userId) => {
  if (isSupabaseConfigured() && userId) {
    const { data } = await supabase
      .from('messages')
      .select('text_content')
      .eq('sender_id', userId)
      .like('text_content', 'USER_SETTING:MUTE:%')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0].text_content === 'USER_SETTING:MUTE:true';
    }
  }
  return null;
};

export const apiSaveMuteSetting = async (userId, isMuted) => {
  if (isSupabaseConfigured() && userId) {
    await supabase.from('messages').insert([
      {
        sender_id: userId,
        text_content: `USER_SETTING:MUTE:${isMuted}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }
};

// 11. Unsend Message (Delete for everyone)
export const apiUnsendMessage = async (message_id) => {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('messages').delete().eq('id', message_id);
    if (error) {
      console.error('Failed to unsend message:', error);
    }
    return { status: 'success' };
  }
  try {
    const res = await fetch(`${getApiBaseUrl()}/messages/${message_id}`, { method: 'DELETE' });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Local unsend failed:', e);
  }
  return { status: 'failed' };
};

// 12. Edit Message Text
export const apiEditMessage = async (message_id, new_text) => {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('messages')
      .update({ text_content: new_text.trim() })
      .eq('id', message_id);

    if (error) {
      console.error('Failed to edit message:', error);
    }
    return { status: 'success' };
  }
  try {
    const res = await fetch(`${getApiBaseUrl()}/messages/${message_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_content: new_text }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Local edit failed:', e);
  }
  return { status: 'failed' };
};

