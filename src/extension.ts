import * as vscode from 'vscode';

const fileTimers: Map<string, number> = new Map();
let activeFile: string | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
let statusBarItem: vscode.StatusBarItem;
let lastActivityTime: number = Date.now();
let totalTime: number = 0;

function getFileName(path: string): string {
    return path.split(/[\\/]/).pop() || 'unknown';
}

function updateStatusBar(seconds: number) {
    if (activeFile) {
        statusBarItem.text = `😎🤙 ${seconds}s on ${getFileName(activeFile)}`;
        statusBarItem.show();
    }
}

function startTimerIfNeeded(context: vscode.ExtensionContext) {
    if (!interval && activeFile) {
        interval = setInterval(() => {
            const now = Date.now();
            const idleTime = now - lastActivityTime;
            const idleTimeout = vscode.workspace.getConfiguration().get<number>('codeTimer.idleTimeout') ?? 10000;

            if (idleTime < idleTimeout) {
                const current = fileTimers.get(activeFile!) || 0;
                const updated = current + 1;
                fileTimers.set(activeFile!, updated);
                totalTime += 1;
                updateStatusBar(updated);
                console.log(`⏱️ ${updated}s on ${getFileName(activeFile!)} | Всего: ${totalTime}s`);

                // Сохраняем прогресс
                context.globalState.update('codeTimer.fileTimers', Object.fromEntries(fileTimers));
                context.globalState.update('codeTimer.totalTime', totalTime);
            } else {
                statusBarItem.text = `⏸️ Пауза — нет активности`;
                statusBarItem.show();
            }
        }, 1000);
    }
}

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('✅ codeTimer активирован!');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    context.subscriptions.push(statusBarItem);

    // Загружаем сохранённые данные
    const savedTimers = context.globalState.get<Record<string, number>>('codeTimer.fileTimers') ?? {};
    const savedTotal = context.globalState.get<number>('codeTimer.totalTime') ?? 0;

    for (const [file, time] of Object.entries(savedTimers)) {
        fileTimers.set(file, time);
    }
    totalTime = savedTotal;

    const initialEditor = vscode.window.activeTextEditor;
    if (initialEditor) {
        handleEditorChange(initialEditor);
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) handleEditorChange(editor);
    });

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => {
        lastActivityTime = Date.now();
        startTimerIfNeeded(context);
    }));

    const showStats = vscode.commands.registerCommand('codeTimer.showStats', () => {
        let message = '⏱️ Время по файлам:\n';
        for (const [file, time] of fileTimers.entries()) {
            message += `${getFileName(file)} — ${time}s\n`;
        }
        vscode.window.showInformationMessage(message);
    });

    const showTotalTime = vscode.commands.registerCommand('codeTimer.showTotalTime', () => {
        vscode.window.showInformationMessage(`😎🤙 Ты провёл ${totalTime} секунд в VS Code.`);
    });

    context.subscriptions.push(showStats, showTotalTime);
}

function handleEditorChange(editor: vscode.TextEditor) {
    if (interval) clearInterval(interval);

    activeFile = editor.document.uri.fsPath;

    if (!fileTimers.has(activeFile)) {
        fileTimers.set(activeFile, 0);
    }

    lastActivityTime = Date.now();
    interval = null;
}

export function deactivate() {
    if (interval) clearInterval(interval);
}
