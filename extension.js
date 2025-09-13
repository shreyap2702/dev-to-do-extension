const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TasksProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren(element) {
        if (!vscode.workspace.rootPath) {
            return Promise.resolve([]);
        }

        try {
            const tasks = this.readTasks();

            if (!element) {
                // Show categories
                return Object.keys(tasks).map(key => ({
                    label: this.getCategoryName(key),
                    isCategory: true,
                    key: key,
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded
                }));
            } else if (element.isCategory) {
                // Show tasks inside category
                const categoryTasks = tasks[element.key] || [];
                return categoryTasks.map(task => ({
                    label: `${task.task ? task.task : "Unnamed Task"} (${task.date || "No date"})`,
                    task: task.task || "Unnamed Task",
                    date: task.date || "No date",
                    category: element.key,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    checkboxState: vscode.TreeItemCheckboxState.Unchecked,
                    id: task.id // stable unique id
                }));
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to read tasks file: ${err.message}`);
            return Promise.resolve([]);
        }
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        if (!element.isCategory) {
            treeItem.contextValue = 'taskItem';
            treeItem.iconPath = new vscode.ThemeIcon('checklist');
            treeItem.checkboxState = element.checkboxState;
            treeItem.id = element.id;
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('folder');
        }
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
        let tasks = JSON.parse(data);

        // Auto-clean invalid entries (remove undefined/empty tasks)
        for (const key of Object.keys(tasks)) {
            tasks[key] = tasks[key].filter(
                t => t && t.task && t.task.trim().length > 0
            );
        }

        return tasks;
    }

    writeTasks(tasks) {
        const vscodeFolderPath = path.join(vscode.workspace.rootPath, '.vscode');
        try {
            if (!fs.existsSync(vscodeFolderPath)) {
                fs.mkdirSync(vscodeFolderPath);
            }
            fs.writeFileSync(this.getDataFilePath(), JSON.stringify(tasks, null, 2));
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to save task: ${err.message}`);
        }
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
    const treeView = vscode.window.createTreeView('dev-todo-list.treeView', {
        treeDataProvider: tasksProvider,
        showCollapseAll: true,
        canSelectMany: false
    });

    treeView.onDidChangeCheckboxState(e => {
        e.items.forEach(item => {
            if (item.checkboxState === vscode.TreeItemCheckboxState.Checked) {
                const tasks = tasksProvider.readTasks();
                const categoryTasks = tasks[item.category];
                const index = categoryTasks.findIndex(t => t.id === item.id);
                if (index > -1) {
                    categoryTasks.splice(index, 1);
                    tasksProvider.writeTasks(tasks);
                    tasksProvider.refresh(); // refresh tree immediately
                    vscode.window.showInformationMessage('Task deleted successfully!');
                }
            }
        });
    });

    let addTaskCommand = vscode.commands.registerCommand('dev-todo-list.addTask', async () => {
        if (!vscode.workspace.rootPath) {
            vscode.window.showInformationMessage('Please open a folder or workspace to use this extension.');
            return;
        }

        const taskInput = await vscode.window.showInputBox({
            prompt: 'Enter a new task:'
        });

        // cancel or empty → exit
        if (taskInput === undefined || taskInput.trim().length === 0) {
            return;
        }
        const task = taskInput.trim();

        const dateInput = await vscode.window.showInputBox({
            prompt: 'Enter a date or note (e.g., today, next week):'
        });

        const date = (dateInput && dateInput.trim().length > 0) ? dateInput.trim() : "No date";

        const options = ['Feature Idea', 'Complete Later', 'Discuss with Team', 'Miscellaneous'];
        const category = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select a category:'
        });

        if (!category) {
            return;
        }

        const tasks = tasksProvider.readTasks();
        const newTask = {
            id: crypto.randomUUID(),
            task,
            date,
            completed: false
        };

        switch (category) {
            case 'Feature Idea':
                tasks.featureIdeas.push(newTask);
                break;
            case 'Complete Later':
                tasks.completeLater.push(newTask);
                break;
            case 'Discuss with Team':
                tasks.discussWithTeam.push(newTask);
                break;
            case 'Miscellaneous':
                tasks.miscellaneous.push(newTask);
                break;
        }

        tasksProvider.writeTasks(tasks);
        tasksProvider.refresh();
        vscode.window.showInformationMessage(`Task added to ${category}!`);
    });

    context.subscriptions.push(addTaskCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
