const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class TasksProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren(element) {
        if (!vscode.workspace.rootPath) {
            return Promise.resolve([]);
        }

        if (!element) {
            const tasks = this.readTasks();
            return Object.keys(tasks).map(key => ({
                label: this.getCategoryName(key),
                isCategory: true,
                key: key,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded
            }));
        } else if (element.isCategory) {
            const tasks = this.readTasks();
            const categoryTasks = tasks[element.key] || [];
            return categoryTasks.map(task => ({
                label: task,
                collapsibleState: vscode.TreeItemCollapsibleState.None
            }));
        }
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        return treeItem;
    }

    getCategoryName(key) {
        switch (key) {
            case 'featureIdeas': return '1. Feature Idea to Implement';
            case 'completeLater': return '2. Left this to complete later';
            case 'discussWithTeam': return '3. Discuss this with team';
            case 'miscellaneous': return '4. Miscellaneous';
            default: return key;
        }
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    readTasks() {
        const dataFilePath = this.getDataFilePath();
        if (!fs.existsSync(dataFilePath)) {
            return {
                "featureIdeas": [],
                "completeLater": [],
                "discussWithTeam": [],
                "miscellaneous": []
            };
        }
        const data = fs.readFileSync(dataFilePath, 'utf-8');
        return JSON.parse(data);
    }

    getDataFilePath() {
        if (!vscode.workspace.rootPath) {
            return null;
        }
        return path.join(vscode.workspace.rootPath, '.vscode', 'tasks.json');
    }
}

function activate(context) {
    const tasksProvider = new TasksProvider();
    vscode.window.createTreeView('dev-todo-list.treeView', { treeDataProvider: tasksProvider });

    let addTaskCommand = vscode.commands.registerCommand('dev-todo-list.addTask', async () => {
        if (!vscode.workspace.rootPath) {
            vscode.window.showInformationMessage('Please open a folder or workspace to use this extension.');
            return;
        }

        const task = await vscode.window.showInputBox({
            prompt: 'Enter a new task:'
        });

        if (!task) {
            return;
        }

        const options = ['Feature Idea', 'Complete Later', 'Discuss with Team', 'Miscellaneous'];
        const category = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select a category:'
        });

        if (!category) {
            return;
        }

        const tasks = tasksProvider.readTasks();
        
        switch (category) {
            case 'Feature Idea':
                tasks.featureIdeas.push(task);
                break;
            case 'Complete Later':
                tasks.completeLater.push(task);
                break;
            case 'Discuss with Team':
                tasks.discussWithTeam.push(task);
                break;
            case 'Miscellaneous':
                tasks.miscellaneous.push(task);
                break;
        }

        const vscodeFolderPath = path.join(vscode.workspace.rootPath, '.vscode');
        if (!fs.existsSync(vscodeFolderPath)) {
            fs.mkdirSync(vscodeFolderPath);
        }
        
        fs.writeFileSync(tasksProvider.getDataFilePath(), JSON.stringify(tasks, null, 2));

        tasksProvider.refresh();
        vscode.window.showInformationMessage(`Task added to ${category}!`);
    });

    context.subscriptions.push(addTaskCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}