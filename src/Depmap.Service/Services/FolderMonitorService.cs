using Depmap.Scanning;
using Depmap.Service.Configuration;
using Microsoft.Extensions.Options;

namespace Depmap.Service.Services;

public sealed class FolderMonitorService : BackgroundService
{
    private readonly DepmapScanner _scanner;
    private readonly MonitorState _state;
    private readonly MonitorOptions _options;
    private readonly ILogger<FolderMonitorService> _logger;
    private readonly List<FileSystemWatcher> _watchers = [];
    private readonly object _gate = new();
    private string[] _roots = [];
    private CancellationTokenSource? _debounceCts;

    public FolderMonitorService(
        DepmapScanner scanner,
        MonitorState state,
        IOptions<MonitorOptions> options,
        ILogger<FolderMonitorService> logger)
    {
        _scanner = scanner;
        _state = state;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var configuredRoots = _options.Roots
            .Where(static root => !string.IsNullOrWhiteSpace(root))
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        _state.SetConfiguredRoots(configuredRoots);

        if (configuredRoots.Length == 0)
        {
            _logger.LogWarning("No Depmap roots configured. Set Depmap:Roots in appsettings or environment.");
            _state.SetError("No roots configured.");
            await Task.Delay(Timeout.Infinite, stoppingToken);
            return;
        }

        _roots = configuredRoots
            .Where(Directory.Exists)
            .ToArray();

        if (_roots.Length == 0)
        {
            _logger.LogWarning("No configured Depmap roots exist on disk.");
            _state.SetError("No configured roots exist on disk.");
            await Task.Delay(Timeout.Infinite, stoppingToken);
            return;
        }

        foreach (var root in configuredRoots.Except(_roots, StringComparer.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Configured root does not exist: {Root}", root);
        }

        foreach (var root in _roots)
        {
            var watcher = new FileSystemWatcher(root)
            {
                IncludeSubdirectories = true,
                EnableRaisingEvents = true,
                NotifyFilter = NotifyFilters.FileName
                    | NotifyFilters.DirectoryName
                    | NotifyFilters.LastWrite
                    | NotifyFilters.CreationTime,
            };

            watcher.Changed += OnFilesystemChanged;
            watcher.Created += OnFilesystemChanged;
            watcher.Deleted += OnFilesystemChanged;
            watcher.Renamed += OnFilesystemChanged;
            watcher.Error += OnWatcherError;
            _watchers.Add(watcher);
        }

        await ScanAsync(stoppingToken);
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            _debounceCts?.Cancel();
            _debounceCts?.Dispose();
            _debounceCts = null;
        }

        foreach (var watcher in _watchers)
        {
            watcher.EnableRaisingEvents = false;
            watcher.Dispose();
        }

        _watchers.Clear();
        return base.StopAsync(cancellationToken);
    }

    private void OnFilesystemChanged(object sender, FileSystemEventArgs args)
    {
        if (IsNoisePath(args.FullPath))
            return;

        _logger.LogInformation("Change detected: {ChangeType} {Path}", args.ChangeType, args.FullPath);
        var changedAt = DateTimeOffset.UtcNow;
        _state.MarkWaiting(changedAt);

        CancellationTokenSource debounceCts;
        lock (_gate)
        {
            _debounceCts?.Cancel();
            _debounceCts?.Dispose();
            _debounceCts = new CancellationTokenSource();
            debounceCts = _debounceCts;
        }

        _ = DebounceAndScanAsync(debounceCts.Token);
    }

    private void OnWatcherError(object sender, ErrorEventArgs args)
    {
        _logger.LogError(args.GetException(), "File watcher error");
        _state.SetError(args.GetException().Message);
    }

    private async Task DebounceAndScanAsync(CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(Math.Max(250, _options.DebounceMilliseconds), cancellationToken);
            await ScanAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
        }
    }

    private async Task ScanAsync(CancellationToken cancellationToken)
    {
        _state.MarkScanning();

        try
        {
            var snapshot = await Task.Run(
                () => _scanner.Scan(
                    new ScanRequest(_roots, _options.IncludeTransitive, _options.IgnoreGlobs),
                    message => _logger.LogInformation("{Message}", message)),
                cancellationToken);

            _state.SetSnapshot(snapshot);
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Depmap scan failed");
            _state.SetError(ex.Message);
        }
    }

    private static bool IsNoisePath(string path)
    {
        var normalized = path.Replace('\\', '/');
        return normalized.Contains("/bin/", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("/obj/", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("/.git/", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("/node_modules/", StringComparison.OrdinalIgnoreCase);
    }
}
