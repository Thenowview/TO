using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace Gize.Desktop;

// Secrets stay in the current Windows user's Credential Manager, outside prompts and job notes.
internal static class JobCredentialVault
{
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
        if (!System.Text.RegularExpressions.Regex.IsMatch(company, "^[a-z0-9_-]{1,40}$") ||
            !System.Text.RegularExpressions.Regex.IsMatch(order, "^[a-f0-9]{32}$") || site.Scheme != "https" || site.UserInfo != "" || site.Port != 443)
            throw new ArgumentException("Invalid saved-login scope");
        return "GIZE/Desktop/" + company + "/" + order + "/" + site.GetLeftPart(UriPartial.Authority);
    }
    internal static void Save(string company, string order, Uri site, string username, string password)
    {
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
        if (!Read(Target(company, order, site), 1, 0, out var buffer))
        {
            int error = Marshal.GetLastWin32Error(); if (error == 1168) return null; throw new Win32Exception(error);
        }
        try
        {
            var credential = Marshal.PtrToStructure<Credential>(buffer);
            if (credential.CredentialBlobSize > 4000 || credential.CredentialBlobSize % 2 != 0) throw new InvalidOperationException("Invalid vault record");
            return (credential.UserName, Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2) ?? "");
        }
        finally {CredFree(buffer);}
    }
    internal static void Remove(string company, string order, Uri site)
    {if (!Delete(Target(company, order, site), 1, 0) && Marshal.GetLastWin32Error() != 1168) throw new Win32Exception(Marshal.GetLastWin32Error());}
}
