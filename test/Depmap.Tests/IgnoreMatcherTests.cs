using Depmap.Parsing;
using Xunit;

namespace Depmap.Tests;

public class IgnoreMatcherTests
{
    [Fact]
    public void Double_star_matches_across_path_separators()
    {
        var m = new IgnoreMatcher(new[] { "**/samples/**" });
        Assert.True(m.IsIgnored("/repos/app/samples/foo/Foo.csproj"));
        Assert.False(m.IsIgnored("/repos/app/src/Foo.csproj"));
    }

    [Fact]
    public void Single_star_stops_at_slashes()
    {
        var m = new IgnoreMatcher(new[] { "*.tmp" });
        Assert.True(m.IsIgnored("/a/b/foo.tmp"));
        Assert.False(m.IsIgnored("/a/b/foo.cs"));
    }

    [Fact]
    public void No_patterns_never_ignores_anything()
    {
        var m = new IgnoreMatcher(Array.Empty<string>());
        Assert.False(m.IsIgnored("/anything"));
    }
}
