export interface LogEntryInput{
    severity: 'info' | 'warning' | 'error';
    message: string;
}

export interface LogEntry{
    PK: string;
    SK: string;
    ID: string;
    Severity: 'info' | 'warning' | 'error';
    Message: string;
    DateTime: string;
}