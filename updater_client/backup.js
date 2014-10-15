var UpdaterClient = UpdaterClient || {}; 

UpdaterClient.backup = {

    scriptsDeployed: false,
    deletingOldBackup: false,
    creatingBackup: false,
    backupFinished: false,
    bScriptLogArea: null,
    bScriptLog: null,
    scriptLogTitle: null,

    appendLog: function (text, loading, error) {
        return UpdaterClient.utils.appendLog(text, loading, error, '#backupOutputArea');
    },

    appendError: function (text) {
        return this.appendLog(text, false, true);
    },

    deployScripts: function (callback) {
        var self = this;
        this.appendLog('Deploying backup scripts to Azure Website', true);

        $.ajax('/backup/deploy').done(function () {
            self.appendLog('Scripts successfully deployed');
            self.scriptsDeployed = true;

            if (callback) {
                callback.call(self);
            }
        });
    },

    makeBackup: function () {
        var self = this;
        this.appendLog('Instructing Azure to create backup (this might take a while)', true);
        
        $.post('/backup/create').done(function (response) {
            if (response) {
                console.log('Triggered create, getting status');
                self.getScriptStatus('create');
            }
        });
    },

    deleteBackup: function () {
        var self = this;

        $('#backup > .title').text('Deleting Backup');
        UpdaterClient.utils.switchPanel('#backup');
        this.appendLog('Instructing Azure to delete backup', true);
        
        $.post('/backup/delete').done(function (response) {
            if (response) {
                self.getScriptStatus('delete');
            }
        });
    },

    restoreBackup: function () {
        var self = UpdaterClient.backup;

        $('#backup > .title').text('Restoring Backup');
        UpdaterClient.utils.switchPanel('#backup');
        self.appendLog('Instructing Azure to restore backup (this might take a while)', true);
        
        $.post('/backup/restore').done(function (response) {
            if (response) {
                self.getScriptStatus('restore');
            }
        });
    },

    getScriptStatus: function (script) {
        var self = UpdaterClient.backup;

        $.ajax({
            url: '/backup/' + script,
            dataType: 'text'
        }).done(function (response) {
            var repeat = false,
                now = new Date().toLocaleTimeString();

            if (response) {
                self.scriptLogTitle = self.scriptLogTitle || $('.scriptLogTitle');
                self.scriptLogTitle.text('Live Script Output (Last Update: ' + now + ')');
                self.scriptLogTitle.show();
                self.bScriptLog = self.bScriptLog || $('#backupScriptLog');
                self.bScriptLog.innerText = response;
                self.bScriptLogArea = self.bScriptLogArea || $('#backupScriptLogArea');
                self.bScriptLogArea.show();
                self.bScriptLogArea.scrollTop(self.bScriptLogArea.scrollHeight);
            }

            if (response && !self.backupFinished && script === 'create') {
                // Done
                if (response.indexOf('Status changed to Success') > -1 && !self.backupFinished) {
                    self.appendLog('All done, initiating update!', false);
                    self.backupFinished = true;

                    setTimeout(function() {
                         UpdaterClient.updater.startInstallation();
                         self.bScriptLog.empty();
                         $('#backupOutputArea').empty();
                    }, 300);
                } 

                // Removing old backup
                if (response.indexOf('Removing old backup') > -1 && !self.deletingOldBackup) {
                    self.appendLog('Removing old backup', true);
                    self.deletingOldBackup = true;
                }

                // Copying folder
                if (response.indexOf('Creating Full Site Backup') > -1 && !self.creatingBackup) {
                    self.appendLog('Backing up files', true);
                    self.creatingBackup = true;
                } 
                
                repeat = true;
            }

            if (response && script === 'delete') {
                // Done
                if (response.indexOf('Status changed to Success') > -1) {
                    self.appendLog('All done, backup deleted!', false);
                    self.appendLog('You can now close this tool.', false);
                } else {
                    repeat = true;
                }
            }

            if (response && script === 'restore') {
                // Done
                if (response.indexOf('Status changed to Success') > -1) {
                    self.appendLog('All done, backup restored. We\'re sorry that we could not update your blog, but everything is like it was before.', false);
                    self.appendLog('You can now close this tool.', false);
                } else {
                    repeat = true;
                }
            }

            if (repeat) {
                setTimeout(function() { self.getScriptStatus(script); }, 800);
            }
        });
    },

    startBackup: function() {
        UpdaterClient.config.backup = true;
        UpdaterClient.utils.switchPanel('#backup');
        UpdaterClient.backup.deployScripts(UpdaterClient.backup.makeBackup);
    }
};