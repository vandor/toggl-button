/*jslint indent: 2 plusplus: true*/
/*global $: false, togglbutton: false, chrome: false*/

'use strict';

function getProjectNameFromLabel(elem) {
  var projectLabel = '', projectLabelEle = $('.pname', elem.parentNode.parentNode);
  if (projectLabelEle) {
    projectLabel = projectLabelEle.textContent.trim();
  }
  return projectLabel;
}

var levelPattern = /(?:^|\s)indent_([0-9]*?)(?:\s|$)/;
function getParentEle(sidebarCurrentEle) {
  var curLevel, parentClass, parentCandidate;
  curLevel = sidebarCurrentEle.className.match(levelPattern)[1];
  parentClass = 'indent_' + (curLevel - 1);

  parentCandidate = sidebarCurrentEle;
  while (parentCandidate.previousElementSibling) {
    parentCandidate = parentCandidate.previousElementSibling;
    if (parentCandidate.classList.contains(parentClass)) {
      break;
    }
  }
  return parentCandidate;
}

function isTopLevelProject(sidebarCurrentEle) {
  return sidebarCurrentEle.classList.contains('indent_1');
}

function getProjectNameHierarchy(sidebarCurrentEle) {
  var parentProjectEle, projectName;
  projectName = $('.name', sidebarCurrentEle).firstChild.textContent.trim();
  if (isTopLevelProject(sidebarCurrentEle)) {
    return [projectName];
  }
  parentProjectEle = getParentEle(sidebarCurrentEle);
  return [projectName].concat(getProjectNameHierarchy(parentProjectEle));
}

function projectWasJustCreated(projectId) {
  return projectId.startsWith('_');
}

function getSidebarCurrentEle(elem) {
  var editorInstance, projectId, sidebarRoot, sidebarColorEle, sidebarCurrentEle;
  editorInstance = elem.closest('.project_editor_instance');
  if (editorInstance) {
    projectId = editorInstance.getAttribute('data-project-id');
    sidebarRoot = $('#projects_list');
    if (projectWasJustCreated(projectId)) {
      sidebarCurrentEle = $('.current', sidebarRoot);
    } else {
      sidebarColorEle = $('#project_color_' + projectId, sidebarRoot);
      if (sidebarColorEle) {
        sidebarCurrentEle = sidebarColorEle.closest('.menu_clickable');
      }
    }
  }
  return sidebarCurrentEle;
}

function getProjectNames(elem) {
  var projectNames, viewingInbox, sidebarCurrentEle;
  viewingInbox = $('#filter_inbox.current, #filter_team_inbox.current');
  if (viewingInbox) {
    projectNames = ['Inbox'];
  } else {
    sidebarCurrentEle = getSidebarCurrentEle(elem);
    if (sidebarCurrentEle) {
      projectNames = getProjectNameHierarchy(sidebarCurrentEle);
    } else {
      projectNames = [getProjectNameFromLabel(elem)];
    }
  }
  return projectNames;
}

togglbutton.render('.task_item .content:not(.toggl)', {observe: true}, function (elem) {
  var link, descFunc, container = $('.text', elem);

  descFunc = function () {
    var clone = container.cloneNode(true),
      i = 0,
      child = null;

    while (clone.children.length > i) {
      child = clone.children[i];
      if (child.tagName === "B"
          || child.tagName === "I"
          || child.tagName === "STRONG"
          || child.tagName === "EM") {
        i++;
      } else if (child.tagName === "A") {
        if (child.classList.contains("ex_link")
            || child.getAttribute("href").indexOf("mailto:") === 0) {
          i++;
        } else {
          child.remove();
        }
      } else {
        child.remove();
      }
    }

    return clone.textContent.trim();
  };

  link = togglbutton.createTimerLink({
    className: 'todoist',
    description: descFunc(),
    projectName: getProjectNames(elem)
  });

  container.insertBefore(link, container.lastChild);
});

togglbutton.render('.project_editor_instance:not(.toggl)', {observe: true}, function (elem) {
  elem.addEventListener('keydown', function (e) {
    if (e.altKey && e.keyCode === 13 && e.target.matches('div.richtext_editor')) {
      chrome.runtime.sendMessage({
        type: 'timeEntry',
        respond: true,
        description: e.target.innerText,
        projectName: getProjectNames(this),
        createdWith: togglbutton.fullVersion + "-" + togglbutton.serviceName,
        service: togglbutton.serviceName
      }, function (response) {
        togglbutton.updateTimerLink(response.entry);
      });
    }
  });
}, 'div#editor');

togglbutton.render('#projects_list:not(.toggl)', {observe: true}, function (elem) {
  elem.addEventListener('keydown', function (e) {
    var projectNameBox, sidebarEle, parentProjNames, project;
    projectNameBox = e.target;
    if (e.altKey && e.keyCode === 13 && projectNameBox.matches('div.richtext_editor')) {
      sidebarEle = projectNameBox.closest('.manager');
      parentProjNames = [];
      if (!isTopLevelProject(sidebarEle)) {
        parentProjNames = getProjectNameHierarchy(getParentEle(sidebarEle));
      }

      chrome.runtime.sendMessage({
        type: 'createProject',
        projectName: projectNameBox.innerText,
        parentProjNames: parentProjNames,
      }, function (response) {
        var indexOfExisting,
            projectsArr = togglbutton.user.projects;
        if (!response) {
          console.log('No response from request to create project ' + projectNameBox.innerText);
        } else if (response.success) {
          project = response.project;
          indexOfExisting = projectsArr.findIndex(p => p.id === project.id);
          if (indexOfExisting) {
              projectsArr[indexOfExisting] = project;
          } else {
              projectsArr.push(project);
          }
          togglbutton.projects[project.name + project.id] = project;
        } else {
          console.log('Failure creating new project ' + projectNameBox.innerText);
        }
      });
    }
  }, {capture: true});
});
