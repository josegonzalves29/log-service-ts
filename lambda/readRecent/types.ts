export interface LogEntryResponse{
    id: string;
    dateTime: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
}

export interface ReadRecentResponse{
    logs: LogEntryResponse[];
    count: number;
}