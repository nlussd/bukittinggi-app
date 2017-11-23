define([
	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/_base/window',
	'dojo/on',
	'dojo/request',
	'esri/request',
	'dojo/io-query',
	'dojo/Deferred',

	'./lib/mapillary-js/mapillary.min'
], function(declare, lang, window, on, request, esriRequest, ioQuery, Deferred,
            Mapillary) {
	var authWindow,
		authDef,
		currentUser;

	/**
	 * Mapillary Utils
	 */
	return {
		Mapillary: Mapillary,
		/**
		 * API Request
		 * @param url
		 * @param requestParams
		 * @returns {*}
		 * @private
		 */
		_request: function(url, requestParams) {
			var def = new Deferred();
			request(url, {
				handleAs: 'json',
				headers: {
					'X-Requested-With': null
				},
				query: lang.mixin({
					client_id: this.clientId
				}, requestParams)
			}, {
				useProxy: false,
				usePost: false
			}).then(function(result) {
				def.resolve(result);
			}, function(err) {
				def.reject(err);
			});
			return def.promise;
		},

		/**
		 * Set Client ID
		 * @param clientId
		 */
		setClientId: function(clientId) {
			this.clientId = clientId;
		},

		/**
		 * Authenticate
		 */
		authenticate: function() {
			var w = 800,
				h = 500,
				top = window.global.top.outerHeight / 2 + window.global.top.screenY - ( h / 2),
				left = window.global.top.outerWidth / 2 + window.global.top.screenX - ( w / 2);
			authDef = new Deferred();
			authWindow = window.global.open(
				'http://www.mapillary.com/connect?client_id=' + this.clientId + '&redirect_uri=' + window.global.location.href + 'widgets/Mapillary/oauth-callback.html&response_type=token&scope=mapillary:user',
				'mapillaryAuth',
				'toolbar=no,scrollbars=no,resizable=no,width=' + w + ',height=' + h + ',top=' + top + ',left=' + left,
				true
			);
			authWindow.focus();

			/*FIXME Need to detect closing of OAuth popup and reject authDef
			 // 1st try
			 authWindow.onbeforeunload = function() {
			 authDef.resolve();
			 };

			 // 2nd
			 on(authWindow, 'beforeunload', function() {
			 authDef.resolve();
			 });*/

			return authDef.promise;
		},

		/**
		 * Callback OAuth
		 * @param response
		 */
		callbackOAuth: function(response) {
			if (!authDef)
				return false;

			if (response.error)
				authDef.reject(response);
			else
				authDef.resolve(response);
		},

		/**
		 * Is Authenticated
		 * @returns {*}
		 */
		isAuthenticated: function() {
			return this.getCurrentUser();
		},

		/**
		 * Get Current User
		 * @returns {*}
		 */
		getCurrentUser: function() {
			var def = new Deferred();
			if (currentUser)
				def.resolve(currentUser);
			this._request('https://a.mapillary.com/v2/me').then(function(user) {
				currentUser = user;
				console.log('MapillaryUtils::getCurrentUser', currentUser);
				def.resolve(currentUser);
			}, function(err) {
				console.error('MapillaryUtils::getCurrentUser', err);
				def.reject(err);
			});
			return def.promise;
		},

		/**
		 * Get User
		 * @param username
		 * @returns {*}
		 */
		getUser: function(username) {
			return this._request('https://a.mapillary.com/v2/u/' + username);
		},

		/**
		 * Filter Request Options
		 * @param requestOptions
		 * @param filter
		 * @returns {*}
		 * @private
		 */
		_filterRequestOptions: function(requestOptions, filter) {
			if (filter.toDate) {
				//ensure date is UTC
				filter.toDate.setTime(filter.toDate.getTime()-filter.toDate.getTimezoneOffset()*60*1000);
				requestOptions.end_time = filter.toDate.toISOString();
			}
			if (filter.fromDate) {
				//ensure date is UTC
				filter.fromDate.setTime(filter.fromDate.getTime()-filter.fromDate.getTimezoneOffset()*60*1000);
				requestOptions.start_time = filter.fromDate.toISOString();
			}
			if (filter.userList && filter.userList.length)
				requestOptions.usernames = filter.userList.map(function(user) {
					return user.username;
				}).join(',');
			return requestOptions;
		},

		/**
		 * Look at Point
		 * @param point
		 * @param filter
		 */
		lookAtPoint: function(point, filter) {
			filter = filter || {};
			var requestOptions = {
				'closeto': point.x.toFixed(10) + ',' + point.y.toFixed(10),
				'lookat': point.x.toFixed(10) + ',' + point.y.toFixed(10),
				'radius': 2000
			};
			requestOptions = this._filterRequestOptions(requestOptions, filter);
			console.log('mapillaryUtils::lookAtPoint', point, requestOptions);
			return this._request('https://a.mapillary.com/v3/images', requestOptions);
		},

		/**
		 * User Fuzzy Search
		 * @param username string
		 * @param requestParams object
		 */
		userFuzzySearch: function(username, requestParams) {
			requestParams = requestParams || {};
			return this._request('https://a.mapillary.com/v3/model.json', lang.mixin({
				paths: JSON.stringify([
					["userFuzzySearch", username, {"from": 0, "to": username.length},
						["avatar", "key", "username"]]
				]),
				method: 'get'
			}, requestParams));
		},

		/**
		 * Feed Items By User Key
		 * @param userKey string
		 * @param requestParams object
		 */
		feedItemsByUserKey: function(userKey, requestParams) {
			requestParams = requestParams || {};
			return this._request('https://a.mapillary.com/v3/model.json', lang.mixin({
				paths: JSON.stringify([
					[
						"feedItemsByUserKey",
						userKey,
						{"from": 0, "to": userKey.length},
						["action_type", "closed", "closed_at", "key", "nbr_objects", "object_type", "objects", "shape", "started_at", "subject_id", "subject_type", "updated_at"]
					]
				]),
				method: 'get'
			}, requestParams));
		},

		/**
		 * Image Close To
		 * @param point
		 * @param filter
		 * @param requestParams
		 * @returns {*}
		 */
		imageCloseTo: function(point, filter, requestParams) {
			requestParams = requestParams || {};
			return this._request('https://a.mapillary.com/v3/model.json', lang.mixin({
				paths: JSON.stringify([
					[
						"imageCloseTo", point.x.toFixed(10) + ':' + point.y.toFixed(10),
						["atomic_scale", "c_rotation", "ca", "calt", "captured_at", "cca", "cfocal", "cl", "gpano", "height", "key", "l", "merge_cc", "merge_version", "orientation", "project", "sequence", "user", "width"],
						["key", "username"]
					]
				]),
				method: 'get'
			}, requestParams));
		},

		/**
		 * Image By User Key
		 * @param imageKey string
		 * @param requestParams object
		 */
		imageByKey: function(imageKey, requestParams) {
			requestParams = requestParams || {};
			return this._request('https://a.mapillary.com/v3/model.json', lang.mixin({
				paths: JSON.stringify([
					[
						[
							"imageByKey",
							imageKey,
							["atomic_scale", "c_rotation", "ca", "calt", "captured_at", "cca", "cfocal", "cl", "gpano", "height", "key", "l", "merge_cc", "merge_version", "orientation", "project", "sequence", "user", "width"],
							["key", "username"]
						]
					]
				]),
				method: 'get'
			}, requestParams));
		},

		/**
		 * Sequence By User Key
		 * @param sequenceKey string
		 * @param requestParams object
		 */
		sequenceByKey: function(sequenceKey, requestParams) {
			requestParams = requestParams || {};
			return this._request('https://a.mapillary.com/v3/model.json', lang.mixin({
				paths: JSON.stringify([
					[
						[
							"sequenceByKey",
							sequenceKey,
							"keys"
						]
					]
				]),
				method: 'get'
			}, requestParams));
		},

		/**
		 * Get Viewer
		 * @returns {Mapillary.Viewer}
		 */
		getViewer: function(domId) {
			if (this.mapillary && this.mapillary[domId])
				return this.mapillary[domId];

			if (!this.mapillary)
				this.mapillary = {};
			this.mapillary[domId] = new Mapillary.Viewer(
				domId,
				this.clientId,
				null,
				{
					renderMode: Mapillary.RenderMode.Fill,
					component: {
						mouse: {
							doubleClickZoom: false
						},
						mapillaryObjects: false,
						marker: true,
						cover: false,
						detection: true,
						attribution: true,
						direction: {
							distinguishSequence: true,
							maxWidth: 460,
							minWidth: 180
						},
						imagePlane: {
							imageTiling: true
						},
						stats: true
					}
				}
			);
			return this.mapillary[domId];
		},

		/**
		 * Destroy Viewer
		 * @param domId
		 */
		destroyViewer: function(domId) {
			this.mapillary && this.mapillary[domId] && delete this.mapillary[domId];
		}
	};
});