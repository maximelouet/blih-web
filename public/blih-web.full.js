/*
 * Copyright 2017-2018 Maxime Louet
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

'use strict';

// Global loading indicator to prevent double actions
let LOADING = false;

// Store user information for future requests
let USER = {
    login: null,
    short_login: null,
    hashed_password: null
};

// Repository list
let REPOSITORIES = [];
/* structure:
    [index]: repo id, NOT uuid
    name: repo name,
    uuid: BLIH UUID,
    recent: bool isJustCreated
*/
// Store repositories that have been created during the session (not opened yet)
let LASTREPOSCREATED = [];
// Store last update timestamp from BLIH server
let LASTREPOUPDATE = 0;

let LASTACTIONTIME = 0;

// SSH keys list
let SSHKEYS = [];
/* structure:
    [index]: sshkey id, NOT uuid
    name: sshkey comment,
    content: sshkey file content,
    recent: bool isJustUploaded
*/
// Store SSH keys that have been uploaded during the session (not opened yet)
let LASTSSHUPLOADED = [];
// Store last update timestamp from BLIH server
let LASTSSHUPDATE = 0;

// Current ACL representation
let ACL = [];
/* structure:
    [index]: ACL li id, NOT uuid
    user: login
    r: true/false
    w: true/false
    a: true/false
*/

// VanillaModalJS object, populated on login
let modal = false;

// Prevent history state reset on repo Delete button click in repo view modal
let noURLChange = false;

// Array of current XHR requests, used to cancel them if needed
let CURRENT_REQUESTS = [];


/******************************************************************************
 * Helper functions
 */

const e = id => {
    return (document.getElementById(id));
}

const c = type => {
    return (document.createElement(type));
}

function removeFromArray(array, element)
{
    const index = array.indexOf(element);
    if (index !== -1) {
        array.splice(index, 1);
    }
}

function getRealLogin(login)
{
    let realLogin = login.trim();
    const oldUserRegex = /^\D+_\D$/;
    if (!realLogin.endsWith("@epitech.eu") && !oldUserRegex.test(realLogin) && realLogin != 'ramassage-tek')
        realLogin += "@epitech.eu";
    return (realLogin);
}

function getShortLogin(realLogin)
{
    let shortLogin = realLogin;
    if (shortLogin.endsWith("@epitech.eu"))
        shortLogin = shortLogin.slice(0, -11);
    return (shortLogin);
}

function preventDefaults(e)
{
    e.preventDefault();
    e.stopPropagation();
}

/******************************************************************************
 * DOM helper functions
 */

function clearElm(elm)
{
    while (elm.lastChild) {
        elm.removeChild(elm.lastChild);
    }
}
function replaceChildren(elm, otherElm)
{
    clearElm(elm);
    while (otherElm.childNodes.length) {
        elm.appendChild(otherElm.childNodes[0]);
    }
}
function replaceElmWithDOM(elm, documentFragment)
{
    clearElm(elm);
    elm.appendChild(documentFragment);
}
function replaceElmWithText(elm, text)
{
    clearElm(elm);
    elm.appendChild(document.createTextNode(text));
}

function htmlEntities(str)
{
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


function historyPush(title, url)
{
    let newTitle = title + ' - BLIH Web';
    history.pushState(null, newTitle, url);
    document.title = newTitle;
}


/******************************************************************************
 * Remember me
 */

function forgetMe()
{
    const savedLogin = localStorage.getItem('savedLogin');
    localStorage.removeItem('savedLogin');
    let userInput = e('login-user');
    userInput.value = '';
    userInput.focus();
    e('login-pass').value = '';
    e('login-form').removeChild(e('forget-me'));
}

function rememberMe(username)
{
    localStorage.setItem('savedLogin', username);
}

function showSavedLogin()
{
    const savedLogin = localStorage.getItem('savedLogin');
    let userInput = e('login-user');
    let passInput = e('login-pass');
    if (savedLogin) {
        userInput.value = savedLogin;
        passInput.focus();
        let forgetMeElm = c('a');
        forgetMeElm.id = 'forget-me';
        forgetMeElm.addEventListener('click', (evt) => {
            evt.preventDefault();
            forgetMe();
        });
        forgetMeElm.innerHTML = 'Forget my login';
        e('login-form').insertBefore(forgetMeElm, e('login-submit'));
    }
    else {
        userInput.focus();
    }
}

if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading"){
    showSavedLogin();
}
else {
    document.addEventListener('DOMContentLoaded', showSavedLogin);
}




/******************************************************************************
 * Modal helper functions
 */

function showModal(id, name)
{
    replaceElmWithText(e('modal-title'), name);
    modal.open('#modal-' + id);
}
function hideModal(id)
{
    modal.close('#modal-' + id);
}
function closeCurrentModal()
{
    if (modal.current)
        modal.close('#' + modal.current.id);
}

function checkRepoConfirm(evt)
{
    let userValue = evt.target.value;
    let button = e('act-repo-confirmdelete');
    if (userValue == REPOSITORIES[modal.current.dataset.repoId].name)
        button.disabled = false;
    else
        button.disabled = true;
}


/******************************************************************************
 * Page loading
 */

function enableAct()
{
    if (!LOADING) {
        document.documentElement.classList.remove('act-disabled');
    }
}

function loader(active)
{
    if (active) {
        loader.count++;
        LOADING = true;
        document.documentElement.classList.add('loading');
        document.documentElement.classList.add('act-disabled');
    }
    else {
        loader.count--;
        if (loader.count <= 0) {
            loader.count = 0;
            LOADING = false;
            document.documentElement.classList.remove('loading');
            setTimeout(enableAct, 400);
        }
    }
}

/******************************************************************************
 * Autologout checking
 */

function updateLastActionTime()
{
    LASTACTIONTIME = Math.floor(Date.now() / 1000);
}

function checkAutologout()
{
    if (isOutdated(LASTACTIONTIME, 60)) {
        localStorage.setItem('autologout', true);
        logout();
    }
}


/******************************************************************************
 * Success and error messages
 */

function userInfo(cclass, ccontent)
{
    var container = e('user-info');
    container.className = cclass;
    if (ccontent)
        container.innerHTML = ccontent;
    else
        container.innerHTML = '';
}

function showError(msg)
{
    if (msg === false) {
        userInfo('hidden', null);
    }
    else {
        userInfo('bg-red', msg);
    }
}
function showSuccess(msg)
{
    if (msg === false) {
        userInfo('hidden', null);
    }
    else {
        userInfo('bg-green', msg);
    }
}


/******************************************************************************
 * Repolist functions
 */

// Populates the global REPOSITORIES variable
// @param response JSON BLIH server response
function generateRepoList(response)
{
    REPOSITORIES = [];
    for (let repo in response) {
        if (!response[repo].name && !response[repo].uuid)
            continue;
        REPOSITORIES.push({
            name: response[repo].name,
            uuid: response[repo].uuid,
            recent: (LASTREPOSCREATED.includes(response[repo].name))
        });
    }
}

// Creates DOM of repository list
// Uses the global REPOSITORIES variable
// @return documentFragment containing all li elements
function createRepoListDOM()
{
    let repoList = document.createDocumentFragment();
    for (var i = 0; i < REPOSITORIES.length; i++) {
        let repo = REPOSITORIES[i];
        let li = c('li');
        li.dataset.id = i;
        if (repo.name === '')
            li.classList.add('no-name');
        else if (repo.name.toUpperCase() == 'BITE')
            li.classList.add('bite');
        if (repo.recent)
            li.classList.add('recent');
        let a = c('a');
        a.tabIndex = 0;
        let span = c('span');
        let spanText;
        if (repo.name === '')
            spanText = document.createTextNode(' ');
        else
            spanText = document.createTextNode(repo.name);
        span.appendChild(spanText);
        a.appendChild(span);
        li.appendChild(a);
        let button = c('button');
        let iElm = c('i');
        iElm.className = 'i-cross';
        button.appendChild(iElm);
        li.appendChild(button);
        repoList.appendChild(li);
    }
    return repoList;
}

function printRepoListDOM()
{
    let repoList = createRepoListDOM();
    let repoListElm = e('repolist');
    clearElm(repoListElm);
    repoListElm.appendChild(repoList);
    if (REPOSITORIES.length == 0)
        repoListElm.classList.add('empty');
    else
        repoListElm.classList.remove('empty');
    LASTREPOUPDATE = Math.floor(Date.now() / 1000);
    replaceElmWithText(e('repo-total-count'), 'Total: ' + REPOSITORIES.length + ' repositor' + ((REPOSITORIES.length == 1) ? 'y' : 'ies'));
}

function generateAndShowRepoList(serverResponse)
{
    generateRepoList(serverResponse);
    printRepoListDOM();
}

function refreshRepoList()
{
    loader(true);
    replaceElmWithText(e('repo-total-count'), 'Loading...');
    retrieve('repo/list')
    .then( (response) => {
        generateAndShowRepoList(response.data);
        loader(false);
    });
}


/******************************************************************************
 * SSH keys list functions
 */

// Populates the global SSHKEYS variable
// @param response JSON BLIH server response
function generateSSHList(response)
{
    SSHKEYS = [];
    for (let key in response) {
        if (!response[key].name && !response[key].content)
            continue;
        SSHKEYS.push({
            name: response[key].name,
            content: response[key].content,
            recent: (LASTSSHUPLOADED.includes(response[key].name))
        });
    }
}

// Creates DOM of repository list
// Uses the global SSHKEYS variable
// @return documentFragment containing all li elements
function createSSHListDOM()
{
    let SSHList = document.createDocumentFragment();
    for (var i = 0; i < SSHKEYS.length; i++) {
        let key = SSHKEYS[i];
        let li = c('li');
        li.dataset.id = i;
        if (key.recent)
            li.classList.add('recent');
        let a = c('a');
        let span = c('span');
        let spanText;
        if (key.name === '')
            spanText = document.createTextNode(' ');
        else
            spanText = document.createTextNode(key.name);
        span.appendChild(spanText);
        a.appendChild(span);
        li.appendChild(a);
        let button = c('button');
        let iElm = c('i');
        iElm.className = 'i-cross';
        button.appendChild(iElm);
        li.appendChild(button);
        SSHList.appendChild(li);
    }
    return SSHList;
}

function generateAndShowSSHList(serverResponse)
{
    generateSSHList(serverResponse);
    printSSHListDOM();
}

function printSSHListDOM()
{
    let SSHList = createSSHListDOM();
    let SSHListElm = e('sshlist');
    clearElm(SSHListElm);
    SSHListElm.appendChild(SSHList);
    if (SSHKEYS.length == 0)
        SSHListElm.classList.add('empty');
    else
        SSHListElm.classList.remove('empty');
    LASTSSHUPDATE = Math.floor(Date.now() / 1000);
    replaceElmWithText(e('ssh-total-count'), 'Total: ' + SSHKEYS.length + ' SSH key' + ((SSHKEYS.length == 1) ? '' : 's'));
}

function refreshSSHList()
{
    loader(true);
    replaceElmWithText(e('ssh-total-count'), 'Loading...');
    retrieve('ssh/list')
    .then( (response) => {
        generateAndShowSSHList(response.data);
        loader(false);
    });
}


/******************************************************************************
 * BLIH server error messages interpretation
 */

function showBlihError(data)
{
    if (data !== null && typeof data === 'object') {
        if (data.error) {
            if (data.error == 'sshkey already exists')
                showError('An SSH key with this name already exists.');
            else if (data.error.endsWith('doesn\'t exists'))
                showError(data.error.replace('doesn\'t exists', 'does not exist.'));
            else if (data.error == 'No spaces allowed')
                showError('Spaces are not allowed.');
            else if (data.error == 'No slash allowed')
                showError('Slashes are not allowed.');
            else
                showError(data.error);
        }
        else if (data.message) {
            showError(data.message);
        }
        else {
            showError(data);
        }
    }
    else {
        showError(data);
    }
}

/******************************************************************************
 * AJAX requests management
 */

function addPendingRequest(xhr)
{
    CURRENT_REQUESTS.push(xhr);
}

function removePendingRequest(xhr)
{
    CURRENT_REQUESTS = CURRENT_REQUESTS.filter(item => item !== xhr);
}

function abortAllRequests()
{
    let length = CURRENT_REQUESTS.length;
    if (length > 0) {
        for (let i = 0; i < length; i++) {
            CURRENT_REQUESTS[i].abort();
        }
        CURRENT_REQUESTS.length = 0;
        loader.count = 1;
        loader(false);
    }
}


/******************************************************************************
 * AJAX function
 */

function retrieve(url, resource = undefined, data = undefined)
{
    let signedData = {
        user: USER.login
    };
    let signature = new jsSHA('SHA-512', 'TEXT');
    signature.setHMACKey(USER.hashed_password, 'TEXT');
    signature.update(USER.login);
    if (data !== undefined) {
        signedData.data = data;
        signature.update(JSON.stringify(data, null, 4));
    }
    signedData.signature = signature.getHMAC('HEX');

    let params = 'signed_data=' + JSON.stringify(signedData);
    if (resource !== undefined) {
        params += '&resource=' + resource;
    }

    updateLastActionTime();

    return new Promise( (resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.onload = () => {
            removePendingRequest(xhr);
            resolve({
                ok: (xhr.status == 200) ? true : false,
                code: xhr.status,
                data: xhr.response
            });
        };
        xhr.onerror = () => {
            abortAllRequests();
            showError('A network error occured');
        };
        xhr.ontimeout = () => {
            abortAllRequests();
            showError('A network timeout occured. Please check your connection and try again');
        }
        xhr.open('POST', '/api/' + url, true);
        xhr.responseType = 'json';
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
        xhr.send(params);
        addPendingRequest(xhr);
    });
}


/******************************************************************************
 * ACL DOM functions
 */

/*
 * Login of the form firstname.lastname@epitech.eu or lastn_f
 * rights of the form "r" or "rwa"
 * returns a DocumentFragment
 */
function generateACLDOM(acl)
{
    let li = c('li');
    let input = c('input');
    input.className = 'acl-user-input';
    input.value = getShortLogin(acl.user);
    input.placeholder = (getShortLogin(acl.user)) ? getShortLogin(acl.user) : 'User';
    let actionsContainer = c('span');
    let aclPermsContainer = c('span');
    aclPermsContainer.className = 'acl-perms';

    let label1 = c('label');
    let cb1 = c('input');
    let span1 = c('span');
    cb1.type = 'checkbox';
    cb1.value = 'r';
    span1.appendChild(document.createTextNode('r'));
    label1.appendChild(cb1);
    label1.appendChild(span1);

    let label2 = c('label');
    let cb2 = c('input');
    let span2 = c('span');
    cb2.type = 'checkbox';
    cb2.value = 'w';
    span2.appendChild(document.createTextNode('w'));
    label2.appendChild(cb2);
    label2.appendChild(span2);

    let label3 = c('label');
    let cb3 = c('input');
    let span3 = c('span');
    cb3.type = 'checkbox';
    cb3.value = 'a';
    span3.appendChild(document.createTextNode('a'));
    label3.appendChild(cb3);
    label3.appendChild(span3);

    if (acl.r)
        cb1.checked = true;
    if (acl.w)
        cb2.checked = true;
    if (acl.a)
        cb3.checked = true;

    aclPermsContainer.appendChild(label1);
    aclPermsContainer.appendChild(label2);
    aclPermsContainer.appendChild(label3);
    let button = c('button');
    button.className = 'btn acl-rem bg-red';
    button.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        let li = evt.target.parentElement.parentElement;
        let ul = li.parentElement;
        ul.removeChild(li);
        if (ul.childNodes.length == 0)
            ul.classList.add('empty');
        checkRepoACLDraft();
    });
    button.appendChild(document.createTextNode('-'));
    li.appendChild(input);
    actionsContainer.appendChild(aclPermsContainer);
    actionsContainer.appendChild(button);
    li.appendChild(actionsContainer);
    return (li);
}

function generateACLListDOM()
{
    let fragment = document.createDocumentFragment();
    let ul = c('ul');
    ul.className = 'acl-list';
    let p = c('p');
    let icon = c('i');
    icon.className = 'i-users';
    p.appendChild(icon);
    let span = c('span');
    span.appendChild(document.createTextNode('ACL'));
    p.appendChild(span);
    fragment.appendChild(p);
    let addBtn = c('button');
    addBtn.className = 'btn acl-add bg-green';
    addBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        let ul = evt.target.parentElement.parentElement.childNodes[1];
        let elm = generateACLDOM({user: '', r: true, w: false, a: false});
        ul.appendChild(elm);
        ul.classList.remove('empty');
        elm.childNodes[0].focus();
        checkRepoACLDraft();
    });
    addBtn.title = 'Add an ACL';
    addBtn.appendChild(document.createTextNode('+'));
    p.appendChild(addBtn);

    const aclLength = ACL.length;
    for (let i = 0; i < aclLength; i++) {
        if (ACL[i].r || !ACL[i].w || !ACL[i].a) {
            let li = generateACLDOM(ACL[i]);
            ul.appendChild(li);
        }
    }
    if (aclLength == 0) {
        ul.classList.add('empty');
    }
    else {
        ul.classList.remove('empty');
    }
    fragment.appendChild(ul);
    return (fragment);
}

function generateACLList(aclListObject)
{
    ACL = [];
    for (let acl in aclListObject) {
        ACL.push({
            user: getShortLogin(acl),
            r: (aclListObject[acl].indexOf('r') > -1),
            w: (aclListObject[acl].indexOf('w') > -1),
            a: (aclListObject[acl].indexOf('a') > -1)
        });
    }
}

function checkRepoACLDraft()
{
    if (modal.current.id == 'modal-repo-create')
        return;
    let container = e('repo-view-acl-container');
    let saveAclButton = e('act-repo-saveacl');
    let lis = container.getElementsByTagName('li');
    if (lis.length != ACL.length) {
        container.dataset.draft = true;
        saveAclButton.disabled = false;
        return;
    }
    for (let i = 0; i < lis.length; i++) {
        let aclPerms = lis[i].childNodes[1].childNodes[0];
        if (getShortLogin(lis[i].childNodes[0].value) != ACL[i].user ||
            aclPerms.childNodes[0].childNodes[0].checked != ACL[i].r ||
            aclPerms.childNodes[1].childNodes[0].checked != ACL[i].w ||
            aclPerms.childNodes[2].childNodes[0].checked != ACL[i].a) {
            container.dataset.draft = true;
            saveAclButton.disabled = false;
            return;
        }
    }
    container.dataset.draft = false;
    saveAclButton.disabled = true;
}



/******************************************************************************
 * Set a repository ACL
 */

function computeACLFromDOM(aclContainer)
{
    let ul = aclContainer.childNodes[1];
    let lis = ul.getElementsByTagName('li');

    let list = [];

    for (let li of lis) {
        let user = li.childNodes[0].value;
        let aclPerms = li.childNodes[1].childNodes[0];
        let r = aclPerms.childNodes[0].childNodes[0].checked;
        let w = aclPerms.childNodes[1].childNodes[0].checked;
        let a = aclPerms.childNodes[2].childNodes[0].checked;
        if (getShortLogin(user).length > 0 && (r || w || a)) {
            list.push({
                user: getShortLogin(user),
                r: r,
                w: w,
                a: a
            });
        }
    }
    return (list);
}

function computeACLToSet(aclContainer)
{
    let ul = aclContainer.childNodes[1];
    let lis = ul.getElementsByTagName('li');

    let toApply = [];

    for (let li of lis) {
        let user = li.childNodes[0].value;
        let aclPerms = li.childNodes[1].childNodes[0];
        let r = aclPerms.childNodes[0].childNodes[0].checked;
        let w = aclPerms.childNodes[1].childNodes[0].checked;
        let a = aclPerms.childNodes[2].childNodes[0].checked;
        if (getShortLogin(user).length > 0 && (r || w || a)) {
            toApply.push({
                user: getShortLogin(user),
                r: r,
                w: w,
                a: a
            });
        }
    }
    for (let a of ACL) {
        if (toApply.filter( (e) => {
            return (getShortLogin(e.user) == getShortLogin(a.user));
        }).length == 0) {
            toApply.push({user: getShortLogin(a.user), r: false, w: false, a: false});
        }
    }
    for (let i = 0; i < toApply.length; i++) {
        let e = toApply[i];
        if (ACL.filter( (a) => {
            return (getShortLogin(a.user) == getShortLogin(e.user) && a.r == e.r && a.w == e.w && a.a == e.a);
        }).length > 0) {
            toApply.splice(i, 1);
        }
    }
    return (toApply);
}

function cleanEmptyACL(list)
{
    let final = [];
    for (let a of list) {
        if (a.user.length > 0 && (a.r || a.w || a.a)) {
            final.push({
                user: getShortLogin(a.user),
                r: a.r,
                w: a.w,
                a: a.a
            });
        }
    }
    return (final);
}

function repoSetACL(repoName, toApply)
{
    loader(true);
    let promises = [];
    for (let acl of toApply) {
        let rights = [];
        if (acl.r)
            rights.push('r');
        if (acl.w)
            rights.push('w');
        if (acl.a)
            rights.push('a');
        let aclObj = {
            acl: rights.join(''),
            user: getRealLogin(acl.user)
        };
        promises.push(
            retrieve('repo/setacl', repoName, aclObj)
            .then( (response) => {
                if (!response.ok) {
                    throw response.data;
                }
            })
            .catch( (error) => {
                throw error;
            })
        );
    }
    return (Promise.all(promises)
        .then( values => {
            loader(false);
        })
        .catch( error => {
            loader(false);
            throw error;
        })
    );
}



/******************************************************************************
 * View a repository's infos
 */

function generateACLLoadingDOM()
{
    let fragment = document.createDocumentFragment();
    let p = c('p');
    let i = c('i');
    let span = c('span');
    let text = document.createTextNode('ACL')
    let loadingText = document.createTextNode('Loading ACL...');
    i.className = 'i-users';
    p.appendChild(i);
    span.appendChild(text);
    p.appendChild(span);
    fragment.appendChild(p);
    fragment.appendChild(loadingText);
    return (fragment);
}

function showRepoViewModal(repoId)
{
    let elm = e('modal-repo-view');
    replaceElmWithText(e('repo-view-creation_date'), 'Loading...');
    let ACLLoadingDOM = generateACLLoadingDOM();
    let repoViewACLContainer = e('repo-view-acl-container')
    repoViewACLContainer.classList.add('acl-loading');
    replaceElmWithDOM(repoViewACLContainer, ACLLoadingDOM);
    elm.dataset.repoId = repoId;
    showModal('repo-view', REPOSITORIES[repoId].name);
    replaceElmWithText(e('repo-view-uuid'), REPOSITORIES[repoId].uuid);
}

function showEmptyRepoViewModal(repoId)
{
    let elm = e('modal-empty-repo-view');
    elm.dataset.repoId = repoId;
    showModal('empty-repo-view', '(no name)');
    replaceElmWithText(e('empty-repo-view-uuid'), REPOSITORIES[repoId].uuid);
}

function getFormattedDate(timestamp)
{
    let fragment = document.createDocumentFragment();
    let date = moment.unix(timestamp);
    let dateString = date.format("MMMM D YYYY HH:mm") + ' ';
    let fromNow = date.fromNow();
    if (fromNow == 'in a few seconds') // idk wtf??
        fromNow = 'a few seconds ago';
    fragment.appendChild(document.createTextNode(dateString));
    let span = c('span');
    span.appendChild(document.createTextNode(fromNow));
    fragment.appendChild(span);
    return (fragment);
}

function openRepo(id)
{
    let repo = REPOSITORIES[id];
    if (!repo.name) {
        showEmptyRepoViewModal(id);
        historyPush('(no name)', '/repositories/_');
        return;
    }
    showRepoViewModal(id);
    historyPush(repo.name, '/repositories/' + encodeURIComponent(repo.name));
    removeFromArray(LASTREPOSCREATED, repo.name);
    let aclContainer = e('repo-view-acl-container');
    aclContainer.dataset.draft = false;
    if (repo.creation_time) {
        replaceElmWithDOM(e('repo-view-creation_date'), getFormattedDate(repo.creation_time));
    }
    else {
        loader(true);
        retrieve('repo/getinfo', repo.name)
        .then( (response) => {
            if (!response.ok) {
                if (response.code == 404) {
                    abortAllRequests();
                    showModal('repo-deleted', repo.name);
                    refreshRepoList();
                }
                else {
                    showBlihError(response.data);
                }
                loader(false);
                return;
            }
            if (response.data.uuid != REPOSITORIES[id].uuid) {
                REPOSITORIES[i].uuid = response.data.uuid;
            }
            REPOSITORIES[id].creation_time = response.data.creation_time;
            replaceElmWithDOM(e('repo-view-creation_date'), getFormattedDate(response.data.creation_time));
            loader(false);
        });
    }
    loader(true);
    retrieve('repo/getacl', repo.name)
    .then( (response) => {
        if (!response.ok && response.data.error != "No ACLs") {
            if (response.code == 404) {
                abortAllRequests();
                showModal('repo-deleted', repo.name);
                refreshRepoList();
            }
            else {
                showBlihError(response.data);
            }
            loader(false);
            return;
        }
        if (response.code == 404)
            generateACLList(null);
        else
            generateACLList(response.data);
        aclContainer.classList.remove('acl-loading');
        replaceElmWithDOM(aclContainer, generateACLListDOM());
        checkRepoACLDraft();
        loader(false);
        let repoCloseButton = e('modal-close');
        repoCloseButton.focus();
        repoCloseButton.blur();
    });
}


/******************************************************************************
 * Create a repository
 */

function createRepo()
{
    let name = e('repo-create-name').value;
    let aclList = e('repo-view-acl-container').childNodes[1];
    e('act-repo-create').blur();

    showError(false);
    if (!name) {
        showError('The name cannot be empty.');
        return;
    }
    if (name.length > 84) {
        showError('The name cannot exceed 84 characters.');
        return;
    }
    loader(true);
    retrieve('repo/create', null, {name: name, type: 'git'})
    .then( (response) => {
        if (!response.ok) {
            showBlihError(response.data);
            loader(false);
            return;
        }
        LASTREPOSCREATED.push(name);
        ACL.length = 0;
        loader(false);
        let ACLToSet = computeACLToSet(e('repo-create-acl-container'));
        repoSetACL(name, ACLToSet)
        .then( (values) => {
            if (ACLToSet.length > 0)
                showSuccess('The repository <b>' + htmlEntities(name) + '</b> has been created with the specified ACL.');
            else
                showSuccess('The repository <b>' + htmlEntities(name) + '</b> has been created without ACL.');
            hideModal('repo-create');
            refreshRepoList();
        })
        .catch( (error) => {
            showBlihError(error);
            hideModal('repo-create');
            // TODO: open repo?
            refreshRepoList();
        });
    });
}



/******************************************************************************
 * Delete a repository
 */

function deleteRepo()
{
    loader(true);
    let repoId = modal.current.dataset.repoId;
    let repo = REPOSITORIES[repoId];
    retrieve('repo/delete', (repo.name) ? repo.name : repo.uuid)
    .then( (response) => {
        if (!response.ok) {
            showBlihError(response.data);
            loader(false);
            return;
        }
        REPOSITORIES.splice(repoId, 1);
        showSuccess('The repository <b>' + htmlEntities(repo.name) + '</b> has been deleted.');
        hideModal('repo-delete');
        printRepoListDOM();
        loader(false);
    });
}

function showRepoDeleteModal(repoId)
{
    let elm = e('modal-repo-delete');
    elm.dataset.repoId = repoId;
    let repo = REPOSITORIES[repoId];
    showModal('repo-delete', repo.name);
    historyPush('Delete ' + repo.name, '/repositories/' + encodeURIComponent(repo.name) + '/delete');
    replaceElmWithText(e('repo-delete-name'), repo.name);
    let confirmName = e('repo-delete-confirmname');
    confirmName.value = '';
    confirmName.focus();
    e('act-repo-confirmdelete').disabled = true;
}
function showEmptyRepoDeleteModal(repoId)
{
    let elm = e('modal-empty-repo-delete');
    elm.dataset.repoId = repoId;
    let repo = REPOSITORIES[repoId];
    showModal('empty-repo-delete', '(no name)');
    historyPush('Delete empty repository', '/repositories/_/delete');
    replaceElmWithText(e('empty-repo-delete-uuid'), REPOSITORIES[repoId].uuid);
}

/******************************************************************************
 * Remove an SSH key
 */


function deleteSSH()
{
    loader(true);
    let sshId = modal.current.dataset.sshId;
    let key = SSHKEYS[sshId];
    let keyName = key.name;
    retrieve('ssh/delete', keyName)
    .then( (response) => {
        if (!response.ok) {
            showBlihError(response.data);
            loader(false);
            return;
        }
        SSHKEYS.splice(sshId, 1);
        showSuccess('The SSH key <b>' + htmlEntities(key.name) + '</b> has been deleted.');
        hideModal('ssh-delete');
        printSSHListDOM();
        loader(false);
    });
}

function showSSHDeleteModal(sshId)
{
    let elm = e('modal-ssh-delete');
    elm.dataset.sshId = sshId;
    let key = SSHKEYS[sshId];
    showModal('ssh-delete', key.name);
    historyPush('Delete ' + key.name, '/sshkeys/' + encodeURIComponent(key.name) + '/delete');
    replaceElmWithText(e('ssh-delete-name'), key.name);
}



/******************************************************************************
 * Upload an SSH key
 */

function showSSHUploadModal(sshId)
{
    let sshUploadInput = e('ssh-upload-input');
    sshUploadInput.value = '';
    showModal('ssh-upload', 'Upload an SSH key');
    sshUploadInput.focus();
    historyPush('Upload an SSH key', '/sshkey-upload');
}

function uploadSSH()
{
    e('act-ssh-upload').blur();
    let key = e('ssh-upload-input').value;
    if (key.length < 50) {
        console.log('TOO SHORT KEY! probably not a key');
    }
    loader(true);
    retrieve('ssh/upload', false, {sshkey: encodeURIComponent(key).replace(/\%2F/g, '/')})
    .then( (response) => {
        if (!response.ok) {
            showBlihError(response.data);
            loader(false);
            return;
        }
        loader(false);
        let nameArray = key.split(' ');
        let name = nameArray[nameArray.length - 1];
        LASTSSHUPLOADED.push(name);
        showSuccess('The SSH key was successfully uploaded.');
        hideModal('ssh-upload');
        refreshSSHList();
    });
}

/******************************************************************************
 * Create a repository
 */

function showRepoCreateModal()
{
    showModal('repo-create', 'Create a repository');
    e('repo-create-name').value = '';
    e('repo-create-name').focus();
    generateACLList({'ramassage-tek': 'r'});
    replaceElmWithDOM(e('repo-create-acl-container'), generateACLListDOM());
    historyPush('Create a repository', '/repository-create');
}


function showSSHViewModal(sshId)
{
    clearElm(e('ssh-view-content'));
    let elm = e('modal-ssh-view');
    elm.dataset.sshId = sshId;
    let key = SSHKEYS[sshId];
    showModal('ssh-view', key.name);
    historyPush(key.name, '/sshkeys/' + encodeURIComponent(key.name));
    replaceElmWithText(e('ssh-view-content'), key.content);
}


/******************************************************************************
 * Login / logout
 */

function getDOM()
{
    return new Promise( (resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.onload = () => {
            resolve({
                ok: (xhr.status == 200) ? true : false,
                code: xhr.status,
                data: xhr.responseText
            });
        };
        xhr.onerror = () => {
            abortAllRequests();
            reject({
                code: 0,
                data: xhr.responseText
            });
        };
        // Send the request
        xhr.open('GET', '/dom.html', true);
        xhr.send();
    });
}

function loadLoggedInScripts()
{
    loader(true);
    let modalScript = c('script');
    modalScript.onload = () => {
        modal = new VanillaModal.default({
            loadClass: 'modal-ok',
            onBeforeOpen: () => {
                updateLastActionTime();
                document.activeElement.blur();
                showError(false);
            },
            onBeforeClose: () => {
                if (!noURLChange) {
                    updateLastActionTime();
                    if (modal.current.id == 'modal-repo-view' || modal.current.id == 'modal-empty-repo-view' || modal.current.id == 'modal-repo-delete' || modal.current.id == 'modal-repo-deleted' || modal.current.id == 'modal-empty-repo-delete' || modal.current.id == 'modal-repo-create') {
                        abortAllRequests();
                        historyPush('Repositories', '/repositories');
                    }
                    if (modal.current.id == 'modal-ssh-view' || modal.current.id == 'modal-ssh-delete' || modal.current.id == 'modal-ssh-upload')
                        historyPush('SSH keys', '/sshkeys');
                }
            }
        });
        loader(false);
    };
    modalScript.async = true;
    modalScript.src = SCRIPT_MODAL_PATH;
    document.head.appendChild(modalScript);

    loader(true);
    let momentScript = c('script');
    momentScript.onerror = () => {
        showError('An error ocurred. Please reload the page.');
    }
    momentScript.onload = () => {
        loader(false);
    };
    momentScript.async = true;
    momentScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js';
    document.head.appendChild(momentScript);
}

function handleSSHClick(evt)
{
    if (evt.target.tagName.toLowerCase() == 'span') {
        let li = evt.target.parentElement.parentElement;
        li.classList.remove('recent');
        showSSHViewModal(li.dataset.id);
    }
    else if (evt.target.tagName.toLowerCase() == 'a') {
        let li = evt.target.parentElement;
        li.classList.remove('recent');
        showSSHViewModal(li.dataset.id);
    }
    else if (evt.target.tagName.toLowerCase() == 'button') {
        let li = evt.target.parentElement;
        showSSHDeleteModal(li.dataset.id);
    }
    else if (evt.target.tagName.toLowerCase() == 'i') {
        let li = evt.target.parentElement.parentElement;
        showSSHDeleteModal(li.dataset.id);
    }
}

function handleRepoClick(evt)
{
    if (evt.target.tagName.toLowerCase() == 'span') {
        let repoItem = evt.target.parentElement.parentElement;
        repoItem.classList.remove('recent');
        openRepo(repoItem.dataset.id);
    }
    else if (evt.target.tagName.toLowerCase() == 'a') {
        let repoItem = evt.target.parentElement;
        repoItem.classList.remove('recent');
        openRepo(repoItem.dataset.id);
    }
    else if (evt.target.tagName.toLowerCase() == 'button') {
        let repoItem = evt.target.parentElement;
        if (REPOSITORIES[repoItem.dataset.id].name == '')
            showEmptyRepoDeleteModal(repoItem.dataset.id);
        else
            showRepoDeleteModal(repoItem.dataset.id);
    }
    else if (evt.target.tagName.toLowerCase() == 'i') {
        let repoItem = evt.target.parentElement.parentElement;
        if (REPOSITORIES[repoItem.dataset.id].name == '')
            showEmptyRepoDeleteModal(repoItem.dataset.id);
        else
            showRepoDeleteModal(repoItem.dataset.id);
    }
}

function isOutdated(timestamp, minutes)
{
    let now = Math.floor(Date.now() / 1000);
    if (timestamp < (now - 60 * minutes)) {
        return (true);
    }
    else {
        return (false);
    }
}

function handleNavChange(evt)
{
    evt.target.blur();
    showError(false);
    let main = e('main');
    if (evt.target.dataset.nav == 'repositories') {
        if (main.classList.contains('repositories')) {
            refreshRepoList();
            return;
        }
        main.classList.remove('sshkeys');
        main.classList.add('repositories');
        historyPush('Repositories', '/repositories');
        if (REPOSITORIES.length == 0 || isOutdated(LASTREPOUPDATE, 10))
            refreshRepoList();
    }
    else {
        if (main.classList.contains('sshkeys')) {
            refreshSSHList();
            return;
        }
        main.classList.remove('repositories');
        main.classList.add('sshkeys');
        historyPush('SSH keys', '/sshkeys');
        if (SSHKEYS.length == 0 || isOutdated(LASTSSHUPDATE, 10))
            refreshSSHList();
    }
}

function handleRepoDeleteButton(evt)
{
    noURLChange = true;
    const repoId = modal.current.dataset.repoId;
    hideModal('repo-view');
    noURLChange = false;
    setTimeout( () => {
        showRepoDeleteModal(repoId);
    }, 220);
}
function handleEmptyRepoDeleteButton(evt)
{
    noURLChange = true;
    const repoId = modal.current.dataset.repoId;
    hideModal('empty-repo-view');
    noURLChange = false;
    setTimeout( () => {
        showEmptyRepoDeleteModal(repoId);
    }, 200);
}
function handleSSHDeleteButton(evt)
{
    noURLChange = true;
    const sshId = modal.current.dataset.sshId;
    hideModal('ssh-view');
    noURLChange = false;
    setTimeout( () => {
        showSSHDeleteModal(sshId);
    }, 220);
}

function checkSSHUploadButton()
{
    let submit = e('act-ssh-upload');
    if (e('ssh-upload-input').value.length < 50)
        submit.disabled = true;
    else
        submit.disabled = false;
}

function updateLoggedInDOM()
{
    document.body.classList.add('logged-in');

    // Add header logged-in elements
    let headerElm = e('header');

    let logoutButton = c('button');
    logoutButton.title = 'Logout';
    logoutButton.innerHTML = '<i class="i-logout"></i>';
    logoutButton.addEventListener('click', (evt) => {
        abortAllRequests();
        showError(false);
        loader(true);
        window.location.href = '/';
    });

    let loggedInUser = c('span');
    loggedInUser.id = "logged-in-user";
    replaceElmWithText(loggedInUser, USER.short_login);

    headerElm.appendChild(logoutButton);
    headerElm.appendChild(loggedInUser);

    // Set header event listeners
    e('brand').addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.currentTarget.blur();
    });

    e('refresh-repolist').addEventListener('click', (evt) => {
        document.activeElement.blur();
        refreshRepoList();
    });
    e('refresh-sshlist').addEventListener('click', (evt) => {
        document.activeElement.blur();
        refreshSSHList();
    });

    // Set modal actions event listeners
    e('act-repo-saveacl').addEventListener('click', (evt) => {
        e('act-repo-saveacl').blur();
        let repoViewACLContainer = e('repo-view-acl-container');
        if (repoViewACLContainer.dataset.draft == 'true')
            repoSetACL(REPOSITORIES[modal.current.dataset.repoId].name, computeACLToSet(repoViewACLContainer))
            .then( (values) => {
                ACL = computeACLFromDOM(repoViewACLContainer);
                replaceElmWithDOM(repoViewACLContainer, generateACLListDOM());
                showSuccess('The specified ACL have been applied.');
                repoViewACLContainer.dataset.draft = false;
                e('act-repo-saveacl').disabled = true;
            })
            .catch( (error) => {
                showBlihError(error);
            });
    });
    e('act-repo-cancelediting').addEventListener('click', (evt) => {
        replaceElmWithDOM(e('repo-view-acl-container'), generateACLListDOM());
        checkRepoACLDraft();
    });
    e('act-repo-delete').addEventListener('click', handleRepoDeleteButton);
    e('act-empty-repo-delete').addEventListener('click', handleEmptyRepoDeleteButton);
    e('act-repo-confirmdelete').addEventListener('click', deleteRepo);
    e('act-empty-repo-confirmdelete').addEventListener('click', deleteRepo);
    e('act-repo-create').addEventListener('click', createRepo);
    e('act-ssh-delete').addEventListener('click', handleSSHDeleteButton);
    e('act-ssh-confirmdelete').addEventListener('click', deleteSSH);

    e('repo-delete-confirmname').addEventListener('input', checkRepoConfirm);

    e('modal-close').addEventListener('keydown', (evt) => {
        if (evt.keyCode == 13)
            closeCurrentModal();
    });
    e('modal-close').addEventListener('click', (evt) => {
        evt.target.blur();
    })

    // SSHkey upload event listeners
    let sshUploadInput = e('ssh-upload-input');
    sshUploadInput.addEventListener('input', checkSSHUploadButton);
    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        sshUploadInput.addEventListener(eventName, preventDefaults);
    })

    ;['dragenter', 'dragover'].forEach(eventName => {
        sshUploadInput.addEventListener(eventName, (e) => {
            sshUploadInput.classList.add('dropping');
        });
    })

    ;['dragleave', 'drop'].forEach(eventName => {
        sshUploadInput.addEventListener(eventName, (e) => {
            sshUploadInput.classList.remove('dropping');
        });
    });
    sshUploadInput.addEventListener('drop', (evt) => {
        let file = evt.dataTransfer.files[0];
        if (!file) {
            console.log('NO FILE DETECTED');
            return;
        }
        loader(true);
        let reader = new FileReader();
        reader.onload = ( (f) => {
            return (e) => {
                sshUploadInput.value = e.target.result.trim();
                checkSSHUploadButton();
                loader(false);
            };
        })(file);
        reader.readAsText(file);
    });

    e('act-ssh-upload').addEventListener('click', uploadSSH);

    // ACL event listeners
    e('repo-view-acl-container').addEventListener('input', checkRepoACLDraft);

    // Set other event listeners

    let repoCreateButtons = document.getElementsByClassName('btn repo-create');
    for (let btn of repoCreateButtons) {
        btn.addEventListener('click', (evt) => {
            showRepoCreateModal();
        })
    }
    let sshUploadButtons = document.getElementsByClassName('btn ssh-upload');
    for (let btn of sshUploadButtons) {
        btn.addEventListener('click', (evt) => {
            showSSHUploadModal();
        })
    }
    let navContainer = document.getElementsByTagName('nav')[0];
    for (let child of navContainer.childNodes) {
        child.addEventListener('click', (evt) => {
            evt.preventDefault();
            handleNavChange(evt);
        })
    }

    // Replace login section with new DOM
    let main = e('main');
    let newMain = e('new-main');
    replaceChildren(main, newMain);
    document.body.removeChild(newMain);
    main.classList.add('repositories');
    e('repolist').addEventListener('click', handleRepoClick);
    e('repolist').addEventListener('keydown', (evt) => {
        if (evt.keyCode == 13)
            handleRepoClick(evt);
    });
    e('sshlist').addEventListener('click', handleSSHClick);
    e('sshlist').addEventListener('keydown', (evt) => {
        if (evt.keyCode == 13)
            handleSSHClick(evt);
    });

    window.addEventListener('popstate', closeCurrentModal);
    window.addEventListener('popstate', (evt) => {
        let main = e('main');
        if (window.location.pathname == '/repositories' && main.classList.contains('sshkeys')) {
            main.classList.remove('sshkeys');
            main.classList.add('repositories');
            historyPush('Repositories', '/repositories');
            evt.stopPropagation();
        } else if (window.location.pathname == '/sshkeys' && main.classList.contains('repositories')) {
            main.classList.remove('repositories');
            main.classList.add('sshkeys');
            historyPush('SSH keys', '/sshkeys');
            evt.stopPropagation();
        }
    });
}

function login()
{
    loader(true);
    showError(false);
    e('login-submit').blur();
    let username = e('login-user').value;
    let password = e('login-pass').value;
    if (username.length < 5 || password.length < 3) {
        setTimeout(() => {
            showError('Invalid username/password');
            loader(false);
        }, 500);
        return;
    }
    username = username.toLowerCase();
    let pass = new jsSHA("SHA-512", "TEXT");
    pass.update(password);
    password = null;
    USER.login = getRealLogin(username);
    USER.hashed_password = pass.getHash("HEX");

    retrieve('repo/list')
    .then( (listResponse) => {
        if (!listResponse.ok && listResponse.code != 404) {
            if (listResponse.code == 401) {
                showError('Invalid username/password');
            }
            else {
                showBlihError(listResponse.data);
            }
            USER.login = false;
            USER.hashed_password = false;
            loader(false);
            return;
        }
        USER.short_login = getShortLogin(username);
        rememberMe(username);

        getDOM()
        .then( (DOMResponse) => {
            if (!DOMResponse.ok) {
                showError('An error occured.');
                loader(false);
                return;
            }
            document.getElementsByTagName('footer')[0].insertAdjacentHTML('beforebegin', DOMResponse.data);
            loadLoggedInScripts();
            updateLoggedInDOM();
            historyPush('Repositories', '/repositories');
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            generateAndShowRepoList(listResponse.data);
            setInterval(checkAutologout, 60000);
            loader(false);
        });
    });
}

function logout()
{
    abortAllRequests();
    loader(true);
    showError(false);
    window.location.href = '/';
}



/******************************************************************************
 * Initialization
 */

function init()
{
    loader.count = 0;
    e('login-form').addEventListener('submit', (evt) => {
        evt.preventDefault();
        if (!LOADING)
            login();
    });
    window.addEventListener('keydown', (evt) => {
        if (evt.keyCode != 13)
            return;
        if (evt.target.id == 'repo-delete-confirmname')
            e('act-repo-confirmdelete').click();
        else if (evt.target.id == 'repo-create-name')
            e('act-repo-create').click();
        else if (evt.target.className == 'acl-user-input' && modal.current.id == 'modal-repo-create')
            e('act-repo-create').click();
        else if (evt.target.className == 'acl-user-input' && modal.current.id == 'modal-repo-view')
            e('act-repo-saveacl').click();
    });
    window.addEventListener('online',  () => {
        let header = document.getElementsByTagName('HEADER')[0];
        header.classList.add('online');
        header.classList.remove('offline');
        document.documentElement.classList.remove('act-disabled');
    });
    window.addEventListener('offline', () => {
        let header = document.getElementsByTagName('HEADER')[0];
        header.classList.add('offline');
        header.classList.remove('online');
        document.documentElement.classList.add('act-disabled');
    });
    if (!navigator.onLine) {
        let header = document.getElementsByTagName('HEADER')[0];
        header.classList.add('offline');
        header.classList.remove('online');
        document.documentElement.classList.add('act-disabled');
    }
    e('user-info').addEventListener('click', (evt) => {
        userInfo('hidden', false);
        evt.target.blur();
    });
    if (localStorage.getItem('autologout')) {
        showError('You have been automatically logged out.');
        localStorage.removeItem('autologout');
    }
    // Polyfill because Edge's HTMLCollections are not iterable
    if (typeof HTMLCollection.prototype[Symbol.iterator] !== 'function') {
        HTMLCollection.prototype[Symbol.iterator] = function () {
            let i = 0;
            return {
                next: () => ({done: i >= this.length, value: this.item(i++)})
            }
        };
    }
}

window.addEventListener('load', () => {
    document.documentElement.classList.remove('first-loading');
});

if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading") {
    init();
}
else {
    document.addEventListener('DOMContentLoaded', init);
}
