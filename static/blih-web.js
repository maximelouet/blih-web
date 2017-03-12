var Guser = false;
var Ghashedp = false;
var actDisabled = false;

const modal = new VanillaModal.default({
  loadClass: 'modal-ok',
  onBeforeOpen: function(){infoHandle('hidden', false)}
});


function switchModal(oldm, newm, newtitle, newact) {
  hideModal(oldm);
  setTimeout(function(){showModal(newm, newtitle, newact)}, 300);
}

function showModal(id, name, actText) {
  var actElm = document.getElementById('modal-act');
  document.getElementById('modal-title').innerHTML = name;
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
  if (wanted == entered)
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
  if (active)
  {
    actDisabled = true;
    document.documentElement.classList.add('loading');
    document.documentElement.classList.add('act-disabled');
    handleError(false);
  }
  else
  {
    actDisabled = false;
    document.documentElement.classList.remove('loading');
    setTimeout(enableAct, 200);
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

function refreshRepolist() {
  repoList(function (success, status, response) {
    if (success && !response.hasOwnProperty('error'))
    {
      var repoList = '';
      for (repo in response)
      {
        if (response.hasOwnProperty(repo))
          repoList += '<li><a href="#" onclick="event.preventDefault(); repoOpen(\'' + response[repo] + '\');"><span>' + response[repo] + '</span></a><button class="btn" title="Delete this repository" onclick="event.preventDefault(); promptDelete(\'' + response[repo] + '\');"><i class="i i-times"></i></button></li>\n';
      }
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
      setTimeout(function(){handleSuccess(true, 'The repository <strong>' + repo + '</strong> has been deleted.')}, 300);
      refreshRepolist();
    }
    else
    {
      handleError(true, 'An error occured.');
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
  var params = 'resource=' + resource + '&signed_data=' + encodeURIComponent(JSON.stringify(signeddata));
  var r = new XMLHttpRequest();
  r.onreadystatechange = function() {
    if (r.readyState == 4) {
      if (callback && typeof(callback) === "function") {
        if (r.status == 200 || r.status == 404)
          callback(true, r.status, JSON.parse(r.responseText));
        else
          callback(false, r.status, r.responseText);
      }
    }
  };
  r.open('POST', '/api/' + url);
  r.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
  r.send(params);
}


function promptDelete(repo) {
  document.getElementById('repo-delete-confirmname').value = '';
  showModal('repo-delete', repo, '<button class="btn bg-red" id="repo-delete-confirmbutton" onclick="event.preventDefault(); if(document.getElementById(\'repo-delete-confirmname\').value == \'' + repo + '\') { repoDelete(\'' + repo + '\'); } else { handleError(\'Wrong confirmation\') };" disabled>Confirm</button>');
  document.getElementById('repo-delete-confirmname').focus();
}

function repoOpen(name)
{
  loader(true);
  var repoinfo = document.getElementById('repo-info');
  var repoinfoacl = document.getElementById('repo-info-acl-container');
  repoinfo.innerHTML = 'Loading repository info...';
  repoinfoacl.innerHTML = 'Loading ACL...';
  showModal('repo-info', name, '<button class="btn bg-green" onclick="event.preventDefault(); repoSetAllAcl(\'' + name + '\', \'repo-info-acl\', function(){refreshRepolist();hideModal(\'repo-info\');});"><i class="i i-refresh"></i> Save ACLs</button><button class="btn bg-red" title="You will be prompted for a confirmation" onclick="event.preventDefault(); hideModal(\'repo-info\'); setTimeout(function(){promptDelete(\'' + name + '\');}, 200);"><i class="i i-trash"></i> Delete</button>');
  repoinfoacl.innerHTML = '<p>ACLs <button class="btn acl-add bg-green" onclick="event.preventDefault(); aclAdd(\'repo-info-acl\', \'\', \'\', true);" title="Add an ACL"> + </button></p><ul id="repo-info-acl" class="acl-list" data-aclnb="0"><span>Loading...</span></ul>';
  repoGetInfo(name, function(success, status, response) {
    if (success && response.message.hasOwnProperty('creation_time') && response.message.hasOwnProperty('uuid'))
    {
      var date = new Date(parseInt(response.message['creation_time']) * 1000);
      repoinfo.innerHTML = 'Created: ' + date.getDate() + ' ' + date.toLocaleString("en-us", { month: "long" }) + ' ' + date.getFullYear() + '<br>' + 'UUID: ' + response.message['uuid'];
    }
    else
      handleError(true, 'An error occured');
  });
  repoGetAcl(name, function(success, status, response) {
    if (success)
    {
      repoinfoacl.innerHTML = '<p>ACLs <button class="btn acl-add bg-green" onclick="event.preventDefault(); aclAdd(\'repo-info-acl\', \'\', \'\', true);"> + </button></p><ul id="repo-info-acl" class="acl-list" data-aclnb="0"><span>Loading</span></ul>';
      if (response.hasOwnProperty('error'))
        document.getElementById('repo-info-acl').innerHTML = '<span>(' + response['error'] + ')</span>';
      else
      {
        for (key in response)
        {
          if (response.hasOwnProperty(key))
            aclAdd('repo-info-acl', key, response[key], false);
        }
      }
    }
    else
      handleApiError(status, response);
    loader(false);
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
      repoSetAllAcl(name, aclRootElmId, function(success, status, response) {
        if (success)
        {
          hideModal('repo-create');
          handleSuccess(true, 'The repository <strong>' + name + '</strong> has been created with the specified ACLs.');
        }
        else
          handleError(true, JSON.stringify(response));
        loader(false);
        refreshRepolist();
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
    response = JSON.parse(response);
    if (response.hasOwnProperty('error'))
      handleError(true, response.error);
    else if (response.hasOwnProperty('message'))
      handleError(true, response.message);
    else
      handleError(true, 'An unknown error has occured.');
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



function login() {
  loader(true);
  handleError(false);
  var username = document.getElementById('login-user').value;
  var password = document.getElementById('login-pass').value;
  if (username.length < 5 || password.length < 5)
  {
    handleError(true, 'Invalid username/password.');
    loader(false);
    return;
  }
  var pass = new jsSHA("SHA-512", "TEXT");
  pass.update(password);
  Guser = username;
  Ghashedp = pass.getHash("HEX");
  repoList(function (success, status, response) {
    if (success && !response.hasOwnProperty('error'))
    {
      document.getElementById('logged-in-user').innerHTML = username;
      document.body.classList.add('logged-in');
      var repoList = '';
      for (repo in response)
      {
        if (response.hasOwnProperty(repo))
          repoList += '<li><a href="#" onclick="event.preventDefault(); repoOpen(\'' + response[repo] + '\');"><span>' + response[repo] + '</span></a><button class="btn" title="Delete this repository" onclick="event.preventDefault(); promptDelete(\'' + response[repo] + '\');"><i class="i i-times"></i></button></li>\n';
      }
      document.getElementById('repolist').innerHTML = repoList;
    }
    else
    {
      Guser = false;
      Ghashedp = false;
      handleError(true, 'Invalid username/password.');
    }
    loader(false)
  });
}


function aclAdd(aclRootElmId, user, rights, intended) {
    var aclRootElm = document.getElementById(aclRootElmId);
    if (parseInt(aclRootElm.dataset.aclnb) + 1 > 7)
      return ;
    if (parseInt(aclRootElm.dataset.aclnb) == 0)
      aclRootElm.innerHTML = '';
    var li = document.createElement('li');
    var name = document.createElement('input');
    name.type = "text";
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
    if (rights)
    {
      if (rights.indexOf('r') > -1)
        cb1.checked = true;
      if (rights.indexOf('w') > -1)
        cb2.checked = true;
      if (rights.indexOf('a') > -1)
        cb3.checked = true;
    }
    var tn1 = document.createTextNode(' r ');
    var tn2 = document.createTextNode(' w ');
    var tn3 = document.createTextNode(' a ');
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
    aclRootElm.removeChild(elmToRem);
    aclRootElm.dataset.aclnb = parseInt(aclRootElm.dataset.aclnb) - 1;
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
  var aclRootElm = document.getElementById(aclRootElmId);
  var aclnb = parseInt(aclRootElm.dataset.aclnb);
  for (i = 0; i < aclnb - 1; i++) {
    {
      repoSetAcl(repo, aclRootElm.children[i].children[0].value, getAclPerms(aclRootElm.children[i].children[1]), null);
    }
  }
  if (aclnb > 0)
    repoSetAcl(repo, aclRootElm.children[aclnb - 1].children[0].value, getAclPerms(aclRootElm.children[aclnb - 1].children[1]), function(success, status, response) {
        if (success)
          handleSuccess(true, 'ACL correctly applied.');
        else
          handleError(true, 'ACL failed.');
        callback(success, status, response);
      });
}

function repoSetAcl(repo, acluser, aclrights, callback) {
  if (!acluser || !aclrights)
  {
    handleError(true, "No ACL specified.");
    return ;
  }
  var repoacl = { acl: aclrights, user: acluser };
  retrieve('reposetacl', repo, repoacl, callback);
}

function showRepoCreate() {
  var aclelm = document.getElementById('repo-create-acl');
  document.getElementById('repo-create-name').value = '';
  aclelm.innerHTML = '<span>(No ACLs)</span>';
  aclelm.dataset.aclnb = 0;
  aclAdd('repo-create-acl', 'ramassage-tek', 'r', false);
  showModal('repo-create', 'Create a repository', '<button class="btn bg-green" onclick="event.preventDefault(); repoCreate(document.getElementById(\'repo-create-name\').value, \'repo-create-acl\', function(repo){ repoSetAllAcl(repo, \'repo-create-acl\', function() { handleSuccess(true, \'ACL correctly applied.\'); refreshRepolist(); }) });" id="repo-create-confirmbutton">Create <i class="i i-plus"></i></button>');
  document.getElementById('repo-create-name').focus();
}