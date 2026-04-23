using Depmap.Scanning;
using Depmap.Service.Contracts;

namespace Depmap.Service.Services;

public sealed class MonitorState
{
    private readonly object _gate = new();
    private string? _graphJson;
    private TaskCompletionSource<long> _changeSignal = NewChangeSignal();
    private MonitorStatus _status = new(0, "idle", Array.Empty<string>(), null, null, null, null);

    public void SetConfiguredRoots(IReadOnlyList<string> roots)
    {
        lock (_gate)
        {
            _status = _status with { Roots = roots };
            AdvanceVersion();
        }
    }

    public void MarkWaiting(DateTimeOffset changeAt)
    {
        lock (_gate)
        {
            _status = _status with { State = "waiting", LastChangeAt = changeAt };
            AdvanceVersion();
        }
    }

    public void MarkScanning()
    {
        lock (_gate)
        {
            _status = _status with { State = "scanning", LastError = null };
            AdvanceVersion();
        }
    }

    public void SetSnapshot(ScanSnapshot snapshot)
    {
        lock (_gate)
        {
            _graphJson = snapshot.GraphJson;
            _status = new(
                _status.Version,
                "ready",
                snapshot.Roots,
                snapshot.ScannedAt,
                _status.LastChangeAt,
                null,
                snapshot.Summary);
            AdvanceVersion();
        }
    }

    public void SetError(string error)
    {
        lock (_gate)
        {
            _status = _status with { State = "error", LastError = error };
            AdvanceVersion();
        }
    }

    public bool TryGetGraphJson(out string graphJson)
    {
        lock (_gate)
        {
            if (_graphJson is null)
            {
                graphJson = string.Empty;
                return false;
            }

            graphJson = _graphJson;
            return true;
        }
    }

    public MonitorStatus GetStatus()
    {
        lock (_gate)
        {
            return _status;
        }
    }

    public Task<long> WaitForChangeAsync(long observedVersion, CancellationToken cancellationToken)
    {
        Task<long> waitTask;
        lock (_gate)
        {
            if (_status.Version != observedVersion)
                return Task.FromResult(_status.Version);

            waitTask = _changeSignal.Task;
        }

        return waitTask.WaitAsync(cancellationToken);
    }

    private void AdvanceVersion()
    {
        var nextVersion = _status.Version + 1;
        _status = _status with { Version = nextVersion };
        var completed = _changeSignal;
        _changeSignal = NewChangeSignal();
        completed.TrySetResult(nextVersion);
    }

    private static TaskCompletionSource<long> NewChangeSignal()
    {
        return new TaskCompletionSource<long>(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
