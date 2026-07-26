using FluentAssertions;
using NcmStudio.Core.Utils;

namespace NcmStudio.Tests;

public class HashVerifierTests
{
    [Fact]
    public void ComputeHashes_KnownContent_ReturnsCorrectHashes()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, "Hello, NCM World!");
            var (md5, sha256) = HashVerifier.ComputeHashes(path);

            md5.Should().NotBeNullOrEmpty();
            md5.Should().HaveLength(32);
            sha256.Should().NotBeNullOrEmpty();
            sha256.Should().HaveLength(64);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Fact]
    public void ComputeHashes_SameContentTwice_ReturnsSameHashes()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, "Test content 12345");
            var (md51, sha2561) = HashVerifier.ComputeHashes(path);
            var (md52, sha2562) = HashVerifier.ComputeHashes(path);

            md51.Should().Be(md52);
            sha2561.Should().Be(sha2562);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Fact]
    public void ComputeHashes_EmptyFile_DoesNotThrow()
    {
        var path = Path.GetTempFileName();
        try
        {
            var (md5, sha256) = HashVerifier.ComputeHashes(path);

            md5.Should().Be("d41d8cd98f00b204e9800998ecf8427e"); // MD5 of empty
            sha256.Should().Be("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
