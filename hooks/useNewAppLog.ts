export function useNewAppLog(_opts?: { pageName?: string; agentId?: string; agentName?: string }) {
    return {
        log: (..._args: any[]) => {},
        yaLog: () => {},
        setPage: (..._args: any[]) => {},
        source: '',
    };
}
