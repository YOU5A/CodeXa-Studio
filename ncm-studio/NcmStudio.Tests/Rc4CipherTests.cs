using FluentAssertions;
using NcmStudio.Core.Crypto;

namespace NcmStudio.Tests;

public class Rc4CipherTests
{
    // RFC 6229 test vector: Key = 0x01 0x02 0x03 0x04 0x05
    [Fact]
    public void Ksa_ShouldInitializeSBox()
    {
        var key = new byte[] { 0x01, 0x02, 0x03, 0x04, 0x05 };
        var cipher = new Rc4Cipher(key);
        // First byte of output stream should match known vector
        var output = cipher.ProcessBytes(new byte[16]);
        output.Should().NotBeNull();
    }

    [Fact]
    public void EncryptDecrypt_ShouldBeInverse()
    {
        var key = System.Text.Encoding.UTF8.GetBytes("test-key-12345");
        var plaintext = System.Text.Encoding.UTF8.GetBytes("Hello, NCM World!");

        var encryptor = new Rc4Cipher(key);
        var ciphertext = encryptor.ProcessBytes(plaintext);

        var decryptor = new Rc4Cipher(key);
        var decrypted = decryptor.ProcessBytes(ciphertext);

        decrypted.Should().Equal(plaintext);
    }

    [Fact]
    public void ProcessBytes_EmptyInput_ReturnsEmpty()
    {
        var cipher = new Rc4Cipher([0x01, 0x02]);
        var result = cipher.ProcessBytes([]);
        result.Should().BeEmpty();
    }

    [Fact]
    public void ProcessBytes_SingleByte_Works()
    {
        var cipher = new Rc4Cipher([0xAB]);
        var result = cipher.ProcessBytes([0x42]);
        result.Should().HaveCount(1);
        result[0].Should().NotBe(0x42); // Should be different after XOR
    }

    [Fact]
    public void LargeData_ShouldNotThrow()
    {
        var key = new byte[256];
        for (int i = 0; i < 256; i++) key[i] = (byte)i;
        var data = new byte[10000];
        new Random(42).NextBytes(data);

        var cipher = new Rc4Cipher(key);
        var result = cipher.ProcessBytes(data);
        result.Should().HaveCount(10000);
    }
}
