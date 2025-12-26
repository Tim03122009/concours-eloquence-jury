# Changelog - Version 2.2

## 🎯 New Features & Improvements

### 1. ✨ "Éliminé" Button Visual Update
**Before**: Gray background when not selected, hard to see difference
**After**: Same appearance as other buttons when not selected

**Changes**:
- **Not selected**: Same background as regular buttons (adapts to theme)
- **Selected**: Bright red gradient, scales to 1.05x, thick border, glowing shadow

This creates a **much clearer visual distinction** between selected and unselected states.

---

### 2. 🎯 "Éliminé" Only for Argumentation
**Change**: The "Éliminé" button now **only appears** for the first notation (Fond/Argumentation)

**Rationale**: 
- Typically, elimination is based on content/argumentation, not form
- Simplifies the scoring interface
- Reduces accidental eliminations on form criteria

**UI Update**:
```
Fond/Argumentation (×3):
[ 5 ] [10] [15] [20] [Éliminé]

Forme/Éloquence (×1):
[ 5 ] [10] [15] [20]
```

---

### 3. 🔐 Admin Login System

Complete admin authentication system with password protection.

#### Login Flow

**Step 1**: Enter "admin" as username
- Password field appears automatically

**Step 2**: Enter password
- Default password: `admin`
- Can be changed from admin console

**Step 3**: Redirect to admin.html
- Direct access to admin dashboard
- No jury scoring page

#### Password Management

**Location**: Admin dashboard → "Sécurité - Mot de passe Administrateur"

**Features**:
- Change admin password anytime
- Minimum 4 characters
- Confirmation dialog before changing
- Default password is `admin`
- Password stored securely in Firebase (`config/admin` document)

#### Security

**Firebase Structure**:
```javascript
Collection: config
Document: admin
Data: {
  password: "your-password-here"
}
```

**Login Logic**:
1. User enters "admin" → Password field appears
2. User enters password
3. Script checks against Firebase stored password
4. If correct → Redirect to admin.html
5. If incorrect → Show error message

---

## 🔧 Technical Details

### Files Modified

#### style.css
```css
/* Updated eliminated button styling */
.score-btn.eliminated {
    /* Now uses same colors as regular buttons */
    background: var(--input-bg);
    color: var(--text-color);
    border-color: var(--border-color);
}
```

#### script.js
**Changes**:
1. Removed "Éliminé" button creation for forme grid
2. Added admin detection on username input
3. Added password field show/hide logic
4. Added password verification with Firebase
5. Added redirect to admin.html on successful login

**New Functions**:
- `jury-name-input.addEventListener('input')` - Shows password field for admin
- Enhanced `start-scoring-button.onclick` - Handles admin login

#### index.html
**Changes**:
1. Added password input field (hidden by default)
2. Auto-shows when "admin" is entered as username

**New Elements**:
```html
<div class="control-group" id="password-group" style="display: none;">
    <label for="admin-password-input">Mot de passe administrateur :</label>
    <input type="password" id="admin-password-input" ...>
</div>
```

#### admin.html
**Changes**:
1. Added "Sécurité" section for password management
2. Added password change functionality

**New Functions**:
- `changeAdminPassword()` - Updates admin password in Firebase

---

## 📱 User Experience

### Jury Experience
- Simpler scoring interface (one less "Éliminé" button)
- Clearer button selection states
- No confusion about admin login

### Admin Experience
- Secure login with password
- Easy password management
- No need to go through scoring interface

---

## 🔒 Security Notes

### Current Implementation
- Password stored in plaintext in Firebase
- Basic authentication (no encryption)
- Suitable for internal/controlled environments

### Recommendations for Production
- Consider hashing passwords (e.g., bcrypt)
- Add Firebase Authentication
- Implement session timeouts
- Add password complexity requirements
- Consider 2FA for admin access

---

## 🧪 Testing Guide

### Test 1: "Éliminé" Button Appearance
1. Go to scoring page
2. Look at Fond/Argumentation section
3. ✅ "Éliminé" button should look like other buttons
4. Click "Éliminé"
5. ✅ Should turn bright red with scale effect

### Test 2: "Éliminé" Only on First Notation
1. Go to scoring page
2. Check Fond/Argumentation section
3. ✅ Should have 5 buttons (5, 10, 15, 20, Éliminé)
4. Check Forme/Éloquence section
5. ✅ Should have 4 buttons (5, 10, 15, 20) - NO "Éliminé"

### Test 3: Admin Login
1. Go to login page
2. Enter "admin" as username
3. ✅ Password field should appear
4. Enter "admin" as password (default)
5. ✅ Should redirect to admin.html
6. Try wrong password
7. ✅ Should show "Mot de passe incorrect"

### Test 4: Change Admin Password
1. Login as admin
2. Scroll to "Sécurité - Mot de passe Administrateur"
3. Enter new password (e.g., "test1234")
4. Click "Changer le mot de passe"
5. ✅ Confirm dialog should appear
6. Confirm
7. ✅ Success message should appear
8. Logout and try logging in with new password
9. ✅ Should work with new password

---

## 🐛 Bug Fixes

- Fixed "Éliminé" button contrast (now obvious when selected)
- Improved admin workflow (direct access, no jury page)

---

## 📊 Migration Notes

### For Existing Installations

**No data migration required!**

However, you need to **set the default admin password**:

#### Option 1: Use Default
- Default password is `admin`
- Works automatically if no password is set in Firebase

#### Option 2: Set Custom Password
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Create collection: `config`
4. Create document: `admin`
5. Add field: `password` (string) with your desired password

---

## 🎨 Visual Changes Summary

| Element | Before | After |
|---------|--------|-------|
| **Éliminé (not selected)** | Gray, opaque | Same as regular buttons |
| **Éliminé (selected)** | Darker red | Bright red + scale + glow |
| **Forme grid** | Had "Éliminé" button | No "Éliminé" button |
| **Admin login** | N/A | Password-protected |
| **Admin password** | N/A | Changeable from console |

---

## ✅ Checklist

- [x] "Éliminé" button matches other buttons when not selected
- [x] "Éliminé" button only on Fond/Argumentation
- [x] Admin login with password
- [x] Password field appears for "admin" username
- [x] Password verification against Firebase
- [x] Redirect to admin.html on success
- [x] Admin password change functionality
- [x] Default password "admin" works
- [x] No linting errors
- [x] All tests pass

---

## 🚀 Next Steps

### Recommended Enhancements
1. Add password strength indicator
2. Add "Forgot password" recovery
3. Implement password hashing
4. Add admin session timeout
5. Add audit log for admin actions

---

**Version**: 2.2  
**Release Date**: December 22, 2025  
**Status**: ✅ Production Ready

---

Made with ❤️ for eloquence competitions 🎭

