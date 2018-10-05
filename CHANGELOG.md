# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).


## [2.1.0] - 2018-10-03
### Changed
- Fix error on login when user does not have any repository
- Fix error on repository list or SSH list when list is empty

## [2.0.0] - 2018-06-16
### Added
- Add SSH keys handling (view, upload with paste or drag-and-drop, delete)
- Add a "new" label next to repositories that have been created during the session and not opened yet
- Show repository hour creation time in addition to the day of creation
- Show relative repository creation time (time from now) in addition to the other informations
- Add ability to edit ACL users, rather than deleting an ACL and adding another one
- Add refresh button for repositories (and SSH keys)
- Add a second loader in modals because the global spinner isn't really visible when a modal is active
- Handle browser back button for all actions
- Make everything keyboard-accessible (with tab, space and enter)
- Add changelog link in footer
- Add ability to cancel ACL editing without closing and re-opening the repository
- Enable a "Tablet mode" under a specific resolution; this makes buttons larger for mouse-less devices
- Putting "@epitech.eu" after a login is now optional, even on ACL
- Autologout the user after 60 mins of inactivity
- Make use of npm scripts to minify JS, CSS and HTML

### Changed
- Reduce HTML size (remove logged-in DOM on logged-out page)
- Optimize DOM manipulation (appendChild instead of innerHTML)
- Store remembered username client-side (localStorage instead of cookie)
- Optimize JavaScript events (eventListener instead of onclick attribute)
- Improve login form inputs compatibility with password managers (add attributes to inputs, and remove the form and change URL on login successful)
- Improve detection of disabled JavaScript
- Reduce server-side requests timeout delay and improve network error messages
- Reduce requests to BLIH server by caching repository informations (UUID and creation time) and by locally removing a freshly-deleted repository instead of refreshing the list
- Improve AJAX request cancellation (for example, if the user closes a repository modal before the requests finished)
- Improve ACL error handling, on both repository creation and ACL save
- Fix invalid English in BLIH error messages
- Sort ACL alphabetically (by login)
- Avoid modal jumping on repository view if there is only one ACL
- Improve overall responsiveness on mobile devices
