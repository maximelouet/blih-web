/*
 * Copyright 2018 Maxime Louet
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * GitHub repository: https://github.com/maximelouet/blih-web
 */

var Guser = false;
var Ghashedp = false;
var actDisabled = false;
var loaderTimeout = false;

var repoLoadingInfoCompleted = true;
var repoLoadingAclCompleted = true;

const modal = new VanillaModal.default({
    loadClass: 'modal-ok',
    onBeforeOpen: function(){infoHandle('hidden', false)}
});

function updateConnectivity() {
    if (navigator.onLine) {
        document.getElementById('header').className = 'online';
        actDisabled = false;
        document.documentElement.classList.remove('act-disabled');
    } else {
        document.getElementById('header').className = 'offline';
        actDisabled = true;
        document.documentElement.classList.add('act-disabled');
    }
}

window.addEventListener('online',  updateConnectivity);
window.addEventListener('offline', updateConnectivity);
setTimeout(updateConnectivity, 200);


var decodeEntities = (function() {
    // this prevents any overhead from creating the object each time
    var element = document.createElement('div');
    function decodeHTMLEntities (str) {
        if (str && typeof str === 'string') {
            // strip script/html tags
            str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
            str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, '');
            element.innerHTML = str;
            str = element.textContent;
            element.textContent = '';
        }
        return str;
    }
    return decodeHTMLEntities;
})();

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeQuotes(str) {
    return String(str).replace(/\"/g, '&quot;').replace(/\'/g, '&apos;');
}
function escapeQuotesBack(str) {
    return String(str).replace(/\"/g, '&quot;').replace(/\'/g, '\\\'');
}

function switchModal(oldm, newm, newtitle, newact) {
    hideModal(oldm);
    setTimeout(function(){showModal(newm, newtitle, newact)}, 300);
}

function showModal(id, name, actText) {
    var actElm = document.getElementById('modal-act');
    document.getElementById('modal-title').innerHTML = htmlEntities(name);
    if (actText == false) {
        actElm.className = '';
        actElm.innerHTML = '';
    }
    else {
        actElm.className = 'shown';
        actElm.innerHTML = actText;
    }
modal.open('#modal-' + id);
}
function hideModal(id) {
    modal.close('#modal-' + id);
}

function checkRepoConfirm(wanted, entered, button) {
    if (escapeQuotes(wanted) == escapeQuotes(entered).valueOf())
        button.disabled = false;
    else
        button.disabled = true;
}

function enableAct() {
    if (!actDisabled) {
        document.documentElement.classList.remove('act-disabled');
    }
}

function loader(active) {
    clearTimeout(loaderTimeout);
    if (active)
    {
        actDisabled = true;
        document.documentElement.classList.add('loading');
        document.documentElement.classList.add('act-disabled');
        loaderTimeout = setTimeout(function(){ loader(false); }, 15000);
    }
    else
    {
        actDisabled = false;
        document.documentElement.classList.remove('loading');
        setTimeout(enableAct, 200);
        clearTimeout(loaderTimeout);
    }
}

function infoHandle(cclass, ccontent) {
    var container = document.getElementById('info-container');
    container.className = 'info-container ' + cclass;
    if (ccontent)
        container.innerHTML = ccontent;
}

function handleError(open, msg) {
    if (open)
        infoHandle('bg-red', msg);
    else
        infoHandle('hidden', false);
}

function handleSuccess(open, msg) {
    if (open)
        infoHandle('bg-green', msg);
    else
        infoHandle('hidden', false);
}

function computeRepoList(response) {
    var repoList = '';
    for (repo in response)
    {
        if (response.hasOwnProperty(repo))
        {
            repo = htmlEntities(response[repo]);
            if (!repo) {
                repoList += '<li class="no-name">';
                repoList += '<a href="#" onclick="event.preventDefault(); repoOpen(\'\');"><span> </span></a>';
                repoList += '<button class="btn" onclick="event.preventDefault(); repoOpen(\'\');"><i class="i i-times"></i></button>';
            } else {
                repoList += (repo.toUpperCase() == 'BITE') ? '<li class="bite">' : '<li>';
                repoList += '<a href="#" onclick="event.preventDefault(); repoOpen(\'' + escapeQuotesBack(repo) + '\');"><span>' + repo + '</span></a>';
                repoList += '<button class="btn" title="Delete this repository" onclick="event.preventDefault(); promptDelete(\'' + escapeQuotesBack(repo) + '\');"><i class="i i-times"></i></button>';
            }
            repoList += '</li>\n';
        }
    }
    return repoList;
}

function refreshRepolist() {
    repoList(function (success, status, response) {
        if (success && !response.hasOwnProperty('error'))
        {
            var repoList = computeRepoList(response);
            document.getElementById('repolist').innerHTML = repoList;
        }
        else
            handleError(true, 'An error occured.');
        loader(false)
    });
}

function repoList(callback) {
    retrieve('repolist', false, false, callback);
}
function repoGetAcl(repo, callback) {
    retrieve('repogetacl', repo, false, callback);
}
function repoGetInfo(repo, callback) {
    retrieve('repogetinfo', repo, false, callback);
}
function repoDelete(repo) {
    retrieve('repodel', repo, false, function (success, status, response) {
        if (success && response.hasOwnProperty('message') && response.message == 'Repository deleted')
        {
            hideModal('repo-delete');
            setTimeout(function(){handleSuccess(true, 'The repository <strong>' + htmlEntities(repo) + '</strong> has been deleted.')}, 100);
            refreshRepolist();
        }
        else
        {
            handleError(true, 'An error occured while trying to delete the repository.');
        }
        loader(false);
    });
}

function retrieve(url, resource, data, callback) {
    loader(true);
    var signeddata = {user: Guser};
    var signature = new jsSHA("SHA-512", "TEXT");
    signature.setHMACKey(Ghashedp, "TEXT");
    signature.update(Guser);
    if (data != false)
    {
        signeddata['data'] = data;
        signature.update(JSON.stringify(data, null, 4));
    }
    signeddata['signature'] = signature.getHMAC("HEX");
    if (resource == false)
        resource = 'kappa';
    var params = 'resource=' + encodeURIComponent(resource) + '&signed_data=' + encodeURIComponent(JSON.stringify(signeddata));
    var r = new XMLHttpRequest();
    r.onreadystatechange = function() {
        loader(true);
        if (r.readyState == 4) {
            if (callback && typeof(callback) === "function") {
                var success = false;
                var data = r.responseText;
                if (r.status == 200 || r.status == 404) {
                    var parsed = JSON.parse(data);
                    if (!parsed.hasOwnProperty('ERROR'))
                    {
                        success = true;
                        data = parsed;
                    }
                }
                callback(success, r.status, data);
            }
        }
    };
    r.open('POST', '/api/' + url);
    r.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
    r.send(params);
}

function rememberMe(username) {
    loader(true);
    var params = 'saved_login=' + encodeURIComponent(username);
    var r = new XMLHttpRequest();
    r.open('POST', '/rememberme');
    r.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
    r.send(params);
}
function forgetMe() {
    var loginInput = document.getElementById('login-user');
    var saved_login = document.getElementById('saved_login').value;
    var params = 'saved_login=' + encodeURIComponent(saved_login);
    var r = new XMLHttpRequest();
    r.onreadystatechange = function() {
        if (r.readyState == 4) {
            location.reload();
        }
        loader(true);
    };
    r.open('POST', '/forgetme');
    r.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
    loader(true);
    r.send(params);
}


function promptDelete(repo) {
    document.getElementById('repo-delete-confirmname').value = '';
    showModal('repo-delete', repo, '<button class="btn bg-red" id="repo-delete-confirmbutton" onclick="event.preventDefault(); repoDelete(decodeEntities(document.getElementById(\'modal-title\').innerHTML));" disabled>Confirm deletion</button>');
    document.getElementById('repo-delete-confirmname').focus();
}

function handleSaveAcl(success) {
    if (success)
        handleSuccess(true, "The specified ACLs have been applied.");
}


function repoOpen(name) {
    loader(true);
    handleError(false);
    var repoinfo = document.getElementById('repo-info');
    var repoinfoacl = document.getElementById('repo-info-acl-container');
    if (!name) { // fix for repositories with empty names
        repoinfo.innerHTML = '<p class="repo-open-error">This repository has an empty name, we can\'t access their data through BLIH\'s API.</p>';
        repoinfoacl.innerHTML = '';
        showModal('repo-info', '(no name)', '<button disabled class="btn bg-green" id="save-acl" onclick="event.preventDefault();"><i class="i i-refresh"></i> Save ACLs</button><button class="btn bg-red" disabled onclick="event.preventDefault();"><i class="i i-trash"></i> Delete</button>');
        loader(false);
        return;
    }
    repoLoadingInfoCompleted = false;
    repoLoadingAclCompleted = false;
    repoinfo.innerHTML = '<span>Loading repository info...</span>';
    repoinfoacl.innerHTML = '<p>ACLs <button class="btn acl-add bg-green" onclick="event.preventDefault(); aclAdd(\'repo-info-acl\', \'\', \'\', true);" title="Add an ACL"> + </button></p><ul id="repo-info-acl" class="acl-list" data-aclnb="0" data-acltorem=""><span>Loading...</span></ul>';
    showModal('repo-info', name, '<button disabled class="btn bg-green" id="save-acl" onclick="event.preventDefault(); repoSetAllAcl(decodeEntities(document.getElementById(\'modal-title\').innerHTML), \'repo-info-acl\', handleSaveAcl);"><i class="i i-refresh"></i> Save ACLs</button><button class="btn bg-red" title="You will be prompted for a confirmation" onclick="event.preventDefault(); hideModal(\'repo-info\'); setTimeout(function(){promptDelete(\'' + escapeQuotesBack(name) + '\');}, 200);"><i class="i i-trash"></i> Delete</button>');
    repoGetInfo(name, function(success, status, response) {
        repoLoadingInfoCompleted = true;
        if (success && response.hasOwnProperty('error')) {
            repoinfo.innerHTML = '<p class="repo-open-error">' + response['error'] + '</p>';
            repoinfoacl.innerHTML = '';
            document.getElementById('modal-act').innerHTML = '<button disabled class="btn bg-green" id="save-acl" onclick="event.preventDefault();"><i class="i i-refresh"></i> Save ACLs</button><button disabled class="btn bg-red" onclick="event.preventDefault();"><i class="i i-trash"></i> Delete</button>';
            if (repoLoadingAclCompleted)
                loader(false);
        }
        else if (success && response.message && response.message.hasOwnProperty('creation_time') && response.message.hasOwnProperty('uuid')) {
            var date = new Date(parseInt(response.message['creation_time']) * 1000);
            repoinfo.innerHTML = '<b>Created</b>: ' + date.getDate() + ' ' + date.toLocaleString("en-us", { month: "long" }).toLowerCase() + ' ' + date.getFullYear() + '<br>' + '<b>UUID</b>: ' + response.message['uuid'];
            if (repoLoadingAclCompleted)
                loader(false);
        }
        else {
            repoinfoacl.innerHTML = '';
            handleError(true, 'An error occured');
        }
    });
    repoGetAcl(name, function(success, status, response) {
        repoLoadingAclCompleted = true;
        if (success)
        {
            if (response.hasOwnProperty('error')) {
                document.getElementById('repo-info-acl').innerHTML = '<span>(' + response.error + ')</span>';
            }
            else
            {
                for (key in response)
                {
                    if (response.hasOwnProperty(key))
                        aclAdd('repo-info-acl', key, response[key], false);
                }
            }
            if (repoLoadingInfoCompleted)
                loader(false);
        }
        else
            handleApiError(status, response);
    });
}

function repoCreate(name, aclRootElmId) {
    if (!name)
    {
        handleError(true, 'The name cannot be empty!');
        return;
    }
    if (name.length > 84)
    {
        handleError(true, 'The name cannot exceed 84 characters!');
        return;
    }
    var repoinfo = { name: name, type: 'git' };
    retrieve('repocreate', false, repoinfo, function(success, status, response) {
        if (success)
        {
            repoSetAllAcl(name, aclRootElmId, function(success) {
                if (success)
                {
                    refreshRepolist();
                    hideModal('repo-create');
                    handleSuccess(true, 'The repository <strong>' + htmlEntities(name) + '</strong> has been created with the specified ACLs.');
                }
            });
        }
        else
        {
            handleApiError(status, response);
            loader(false);
        }
    });
}

function handleApiError(status, response) {
    loader(false);
    if (status == 0)
        handleError(true, "An error occured while connecting to the server.");
    else
    {
        try {
            response = JSON.parse(response);
            if (response.hasOwnProperty('error'))
                handleError(true, response.error);
            else if (response.hasOwnProperty('message'))
                handleError(true, response.message);
            else
                handleError(true, 'An unknown error has occured.');
        }
        catch (err) {
            console.log(Error("RIP RIP RIP RIP"));
            handleError(true, "An unknown error has occured.");
        }
    }
}

function getFormAcl(dataId) {
    var checkboxes = document.getElementsByName(dataId + '-perm');
    var checked = [];
    for (var i=0; i<checkboxes.length; i++) {
        if (checkboxes[i].checked) {
            checked.push(checkboxes[i].value);
        }
    }
    return checked.join('');
}


function getDOM(callback)
{
    loader(true);
    var r = new XMLHttpRequest();
    r.onreadystatechange = function() {
        loader(true);
        if (r.readyState == 4 && r.status == 200) {
            document.getElementById('logged-in-dom').innerHTML = r.responseText;
            callback();
        }
        else if (r.readyState == 4) {
            handleError(true, 'An unknown error occured.');
        }
    };
    r.open('GET', '/dom');
    r.send();
}

function getRealUser(username) {
    username = username.trim();
    if (!username.endsWith("@epitech.eu"))
        username += "@epitech.eu";
    return (username);
}

function login() {
    if (actDisabled)
        return;
    loader(true);
    handleError(false);
    var username = document.getElementById('login-user').value;
    var password = document.getElementById('login-pass').value;
    if (username.length < 5 || password.length < 3)
    {
        handleError(true, 'Invalid username/password.');
        loader(false);
        return;
    }
    var pass = new jsSHA("SHA-512", "TEXT");
    pass.update(password);
    Guser = getRealUser(username);
    Ghashedp = pass.getHash("HEX");
    repoList(function (success, status, response) {
    if (success && !response.hasOwnProperty('error') && !response.hasOwnProperty('ERROR'))
    {
        loader(true);
        rememberMe(username);
        loader(true);

        getDOM(function(){

            loader(true);
            document.getElementById('logged-in-user').innerHTML = htmlEntities(Guser);
            document.body.classList.add('logged-in');
            var repoList = computeRepoList(response);
            document.getElementById('repolist').innerHTML = repoList;

            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            loader(false);

        });
    }
    else
    {
        Guser = false;
        Ghashedp = false;
        loader(false);
        try {
            var parsed = JSON.parse(response);
            if (parsed.hasOwnProperty('ERROR'))
                handleError(true, parsed["ERROR"]);
            else if (parsed.hasOwnProperty('error'))
            {
              if (parsed['error'] == 'Bad token')
                handleError(true, 'Invalid username/password.');
              else
                handleError(true, parsed['error']);
            }
        } catch (e) {
            handleError(true, 'An unknown error has occured.');
        }
    }
    });
}

function resetSaveAcl() {
    var saveAcl = document.getElementById('save-acl');
    if (saveAcl)
        saveAcl.disabled = false;
    handleError(false, false);
}


function aclAdd(aclRootElmId, user, rights, intended) {
    var aclRootElm = document.getElementById(aclRootElmId);
    if (parseInt(aclRootElm.dataset.aclnb) + 1 > 7)
        return ;
    if (parseInt(aclRootElm.dataset.aclnb) == 0)
        aclRootElm.innerHTML = '';
    var li = document.createElement('li');
    if (intended)
        li.classList.add('draft'); // draft status while not saved
    var name = document.createElement('input');
    name.type = "text";
    if (!intended)
        name.disabled = true;
    else if (aclRootElmId != 'repo-create-acl')
        document.getElementById("save-acl").disabled = false;
    if (user)
    {
        name.placeholder = user;
        name.value = user;
    }
    else
    {
        name.placeholder = "User";
    }
    name.maxlength = 84;
    var span = document.createElement('span');
    span.className = 'acl-rights';
    var label1 = document.createElement('label');
    var label2 = document.createElement('label');
    var label3 = document.createElement('label');
    label1.onselectstart = function(){return false};
    label2.onselectstart = function(){return false};
    label3.onselectstart = function(){return false};
    var span1 = document.createElement('span');
    var span2 = document.createElement('span');
    var span3 = document.createElement('span');
    var cb1 = document.createElement('input');
    var cb2 = document.createElement('input');
    var cb3 = document.createElement('input');
    cb1.type = "checkbox";
    cb2.type = "checkbox";
    cb3.type = "checkbox";
    cb1.value = "r";
    cb2.value = "w";
    cb3.value = "a";
    cb1.onclick = checkboxToggleHandler;
    cb2.onclick = checkboxToggleHandler;
    cb3.onclick = checkboxToggleHandler;
    if (aclRootElmId != 'repo-create-acl')
    {
        cb1.onchange = resetSaveAcl;
        cb2.onchange = resetSaveAcl;
        cb3.onchange = resetSaveAcl;
    }
    if (rights)
    {
        if (rights.indexOf('r') > -1)
            cb1.checked = true;
        if (rights.indexOf('w') > -1)
            cb2.checked = true;
        if (rights.indexOf('a') > -1)
            cb3.checked = true;
    }
    else
        cb1.checked = true;
    var tn1 = document.createTextNode('r ');
    var tn2 = document.createTextNode('w ');
    var tn3 = document.createTextNode('a ');
    label1.appendChild(cb1);
    label2.appendChild(cb2);
    label3.appendChild(cb3);
    span1.appendChild(tn1);
    span2.appendChild(tn2);
    span3.appendChild(tn3);
    label1.appendChild(span1);
    label2.appendChild(span2);
    label3.appendChild(span3);
    span.appendChild(label1);
    span.appendChild(label2);
    span.appendChild(label3);
    var button = document.createElement('button');
    button.className = 'btn acl-rem bg-red';
    button.onclick = function(e){e.stopPropagation(); aclRem(this.parentElement.parentElement, this.parentElement)};
    var btntext = document.createTextNode(' - ');
    button.appendChild(btntext);
    li.appendChild(name);
    li.appendChild(span);
    li.appendChild(button);

    aclRootElm.appendChild(li);
    aclRootElm.dataset.aclnb = parseInt(aclRootElm.dataset.aclnb) + 1;
    if (intended)
        name.focus();
}

function aclRem(aclRootElm, elmToRem) {
    if (parseInt(aclRootElm.dataset.aclnb) <= 0)
        return;
    aclRootElm.dataset.aclnb = parseInt(aclRootElm.dataset.aclnb) - 1;
    if (!elmToRem.classList.contains('draft'))
    {
        var acltorem = aclRootElm.dataset.acltorem.split(',');
        if (acltorem == ',')
            acltorem = '';
        acltorem.push(elmToRem.children[0].value);
        aclRootElm.dataset.acltorem = acltorem.toString();
        resetSaveAcl();
    }
    aclRootElm.removeChild(elmToRem);
    if (parseInt(aclRootElm.dataset.aclnb) == 0)
        aclRootElm.innerHTML = '<span>(No ACLs)</span>';
}

function getAclPerms(aclSpanElm) {
    var acls = '';
    for (i = 0; i < 3; i++) {
        if (aclSpanElm.children[i].children[0].checked == true)
            acls += aclSpanElm.children[i].children[0].value;
    }
    return (acls);
}


function repoSetAllAcl(repo, aclRootElmId, callback) {

    let rsacPromise = new Promise( (resolve, reject) => {

        loader(true);
        var aclRootElm = document.getElementById(aclRootElmId);
        var aclnb = parseInt(aclRootElm.dataset.aclnb);
        var acltorem = aclRootElm.dataset.acltorem.split(',');
        var acltoremnb = acltorem.length - 1;

        if (aclnb == 0 && acltoremnb == 0)
            resolve(aclRootElmId);

        // handle ACLs to update/set
        for (iaclset = 0; iaclset < aclnb; iaclset++) {

            var curindex = iaclset;
            repoSetAcl(
                repo,
                aclRootElm.children[iaclset].children[0].value,
                getAclPerms(aclRootElm.children[iaclset].children[1]),
                function(success, status, response) {
                    if (success)
                    {
                        if (aclRootElm.children[curindex].classList.contains('for-deletion')) {
                            aclRootElm.dataset.aclnb = parseInt(aclRootElm.dataset.aclnb) - 1;

                            aclRootElm.removeChild(aclRootElm.children[curindex]);
                            if (parseInt(aclRootElm.dataset.aclnb) == 0)
                                aclRootElm.innerHTML = '<span>(No ACLs)</span>';
                        }
                        else {
                            aclRootElm.children[curindex].classList.remove('draft'); // reset 'draft' status
                            aclRootElm.children[curindex].children[0].disabled = true;
                        }
                    }
                    if (!success)
                        reject([status, response, aclRootElmId]);
                    else if (curindex == aclnb - 1 && acltoremnb == 0)
                        resolve(aclRootElmId);
                }
            );
        }


        // handle ACLs to remove
        for (iaclrem = 1; iaclrem <= acltoremnb; iaclrem++) {
            var curindex = iaclrem;

            repoSetAcl(
                repo,
                acltorem[iaclrem],
                "",
                function(success, status, response) {
                    if (!success)
                        reject([status, response, aclRootElmId]);
                    else if (curindex == acltoremnb)
                        resolve(aclRootElmId);
                }
            );
        };
    });


    rsacPromise.then(
        (aclRootElmId) => {
            if (aclRootElmId != 'repo-create-acl')
                document.getElementById('save-acl').disabled = true;
            loader(false);
            callback(true);
        })
    .catch(
        (reason) => {
            loader(false);
            if (Array.isArray(reason))
            {
                if (reason[2] != 'repo-create-acl')
                    document.getElementById('save-acl').disabled = false;
                else
                {
                    refreshRepolist();
                    hideModal('repo-create');
                    refreshRepolist();
                }

                if (reason[0] == 99)
                    handleError(true, reason[1]);
                else
                    handleApiError(reason[0], reason[1]);
            }
            else
                handleError(true, reason);
            callback(false);
        });

}

function repoSetAcl(repo, acluser, aclrights, callback) {
    var status = true;

    if (!acluser || acluser.length == 0)
        callback(false, 99, "Invalid ACL user.");
    else if (acluser == Guser)
        callback(false, 99, "Can't change acl for owner");
    else
    {
        var repoacl = { acl: aclrights, user: acluser };
        retrieve('reposetacl', repo, repoacl, callback);
    }
}

function showRepoCreate() {
    var aclelm = document.getElementById('repo-create-acl');
    document.getElementById('repo-create-name').value = '';
    aclelm.innerHTML = '<span>(No ACLs)</span>';
    aclelm.dataset.aclnb = 0;
    aclAdd('repo-create-acl', 'ramassage-tek', 'r', true);
    showModal('repo-create', 'Create a repository', '<button class="btn bg-green" onclick="event.preventDefault(); repoCreate(document.getElementById(\'repo-create-name\').value, \'repo-create-acl\');" id="repo-create-confirmbutton">Create <i class="i i-plus"></i></button>');
    document.getElementById('repo-create-name').focus();
}

function checkboxToggleHandler() {
    var acls = this.parentElement.parentElement.getElementsByTagName('input');
    if (acls[0].checked === false && acls[1].checked === false && acls[2].checked === false) {
        this.parentElement.parentElement.parentElement.classList.add('for-deletion');
    } else {
        this.parentElement.parentElement.parentElement.classList.remove('for-deletion');
    }
}

function attachCheckboxHandlers(modalElm) {

    var elms = modalElm.getElementsByTagName('input');

    // assign function to onclick property of each checkbox
    for (var i = 0, len = elms.length; i < len; i++) {
        if (elms[i].type === 'checkbox') {
            elms[i].onclick = checkboxToggleHandler;
        }
    }
}
