using FluentAssertions;
using NcmStudio.Core.Crypto;

namespace NcmStudio.Tests;

public class AesEcbDecryptorTests
{
    [Fact]
    public void Decrypt_128BitKey_RoundTrip()
    {
        var key = new byte[16];
        new Random(1).NextBytes(key);
        var plaintext = new byte[32];
        new Random(2).NextBytes(plaintext);

        using var aes = System.Security.Cryptography.Aes.Create();
        aes.Key = key;
        aes.Mode = System.Security.Cryptography.CipherMode.ECB;
        aes.Padding = System.Security.Cryptography.PaddingMode.PKCS7;
        using var encryptor = aes.CreateEncryptor();
        var ciphertext = encryptor.TransformFinalBlock(plaintext, 0, plaintext.Length);

        var decrypted = AesEcbDecryptor.Decrypt(key, ciphertext);
        decrypted.Should().Equal(plaintext);
    }

    [Fact]
    public void Decrypt_ValidCiphertext_Works()
    {
        var key = new byte[16];
        new Random(3).NextBytes(key);
        var plaintext = new byte[16];
        new Random(4).NextBytes(plaintext);

        using var aes = System.Security.Cryptography.Aes.Create();
        aes.Key = key;
        aes.Mode = System.Security.Cryptography.CipherMode.ECB;
        aes.Padding = System.Security.Cryptography.PaddingMode.PKCS7;
        using var encryptor = aes.CreateEncryptor();
        var ciphertext = encryptor.TransformFinalBlock(plaintext, 0, plaintext.Length);

        var decrypted = AesEcbDecryptor.Decrypt(key, ciphertext);
        decrypted.Should().Equal(plaintext);
    }

    [Fact]
    public void Decrypt_EmptyData_ReturnsEmpty()
    {
        var key = new byte[16];
        new Random(5).NextBytes(key);
        var result = AesEcbDecryptor.Decrypt(key, []);
        result.Should().BeEmpty();
    }

    [Fact]
    public void Decrypt_InvalidKeyLength_ShouldThrow()
    {
        var key = new byte[10];
        var data = new byte[16];
        var act = () => AesEcbDecryptor.Decrypt(key, data);
        act.Should().Throw<System.Security.Cryptography.CryptographicException>();
    }
}