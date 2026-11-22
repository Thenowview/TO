using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace Gize.Desktop;

// Secrets stay in the current Windows user's Credential Manager, outside prompts and job notes.
internal static class JobCredentialVault
{
    internal static bool IsLocked { get; private set; } = true;
    internal static void Lock() => IsLocked = true;
    internal static void Unlock() => IsLocked = false;
    private static void RequireUnlocked()
    {if (IsLocked) throw new InvalidOperationException("Saved logins are locked for this app session");}

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential
    {
        internal uint Flags, Type;
        [MarshalAs(UnmanagedType.LPWStr)] internal string TargetName;
        [MarshalAs(UnmanagedType.LPWStr)] internal string? Comment;
        internal System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        internal uint CredentialBlobSize;
        internal IntPtr CredentialBlob;
        internal uint Persist, AttributeCount;
        internal IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)] internal string? TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)] internal string UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Write(ref Credential credential, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll")] private static extern void CredFree(IntPtr buffer);
    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Delete(string target, uint type, uint flags);
    private static string Target(string company, string order, Uri site)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(company, @"\A[a-z0-9_-]{1,40}\z") ||
            !System.Text.RegularExpressions.Regex.IsMatch(order, @"\A[a-f0-9]{32}\z") || site.Scheme != "https" || site.UserInfo != "" || site.Port != 443)
            throw new ArgumentException("Invalid saved-login scope");
        return "GIZE/Desktop/" + company + "/" + order + "/" + site.GetLeftPart(UriPartial.Authority);
    }
    internal static void Save(string company, string order, Uri site, string username, string password)
    {
        RequireUnlocked();
        if (username.Length is < 1 or > 256 || password.Length is < 1 or > 2000) throw new ArgumentException("Enter a bounded username and password");
        byte[] bytes = Encoding.Unicode.GetBytes(password); IntPtr secret = Marshal.AllocCoTaskMem(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, secret, bytes.Length);
            var credential = new Credential {Type = 1, TargetName = Target(company, order, site), UserName = username,
                CredentialBlobSize = (uint)bytes.Length, CredentialBlob = secret, Persist = 2};
            if (!Write(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        finally {for (int i = 0; i < bytes.Length; i++) Marshal.WriteByte(secret, i, 0); Marshal.FreeCoTaskMem(secret); Array.Clear(bytes);}
    }
    internal static (string Username, string Password)? Load(string company, string order, Uri site)
    {
        RequireUnlocked();
        if (!Read(Target(company, order, site), 1, 0, out var buffer))
        {
            int error = Marshal.GetLastWin32Error(); if (error == 1168) return null; throw new Win32Exception(error);
        }
        try
        {
            var credential = Marshal.PtrToStructure<Credential>(buffer);
            ValidateRecord(credential.CredentialBlobSize, credential.CredentialBlob, credential.UserName);
            return (credential.UserName, Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2) ?? "");
        }
        finally {CredFree(buffer);}
    }
    internal static void ValidateRecord(uint size, IntPtr blob, string? username)
    {
        if (size is < 2 or > 4000 || size % 2 != 0 || blob == IntPtr.Zero ||
            string.IsNullOrEmpty(username) || username.Length > 256)
            throw new InvalidOperationException("Invalid vault record");
    }
    internal static void Remove(string company, string order, Uri site)
    {if (!Delete(Target(company, order, site), 1, 0) && Marshal.GetLastWin32Error() != 1168) throw new Win32Exception(Marshal.GetLastWin32Error());}
}
