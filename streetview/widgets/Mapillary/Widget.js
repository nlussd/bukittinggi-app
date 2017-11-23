/* globals define, esri */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/dom',
    'dojo/on',
    'dojo/topic',
    'dojo/debounce',
    'dojo/Deferred',
    'dojo/promise/all',
	'dojo/store/Memory',
	'dojo/dom-style',
	'dojo/dom-class',
	'dojo/query',

    'dijit/_WidgetsInTemplateMixin',
    'dijit/form/Form',
    'dijit/form/CheckBox',
    'dijit/form/TextBox',
    'dijit/form/DateTextBox',
    'dijit/form/ComboBox',

    'esri/Color',
    'esri/geometry/Point',
    'esri/geometry/webMercatorUtils',
    'esri/graphic',
    'esri/InfoTemplate',
    'esri/layers/VectorTileLayer',
    'esri/SpatialReference',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleMarkerSymbol',
	'esri/symbols/PictureMarkerSymbol',

    'jimu/BaseWidget',
    'jimu/LayerInfos/LayerInfos',
    'jimu/dijit/LoadingIndicator',

    'widgets/Mapillary/mapillaryUtils',
    'widgets/Mapillary/mapillary-objects/MapillaryObjects',
    'widgets/Mapillary/mapillary-objects/MapillaryMarkers',
	'widgets/Mapillary/TagCloud',

    'dojo/text!widgets/Mapillary/mapillary-style.json'
], function(declare, lang, dom, on, topic, debounce, Deferred, all, Memory, domStyle, domClass, domQuery,
            _WidgetsInTemplateMixin, Form, CheckBox, TextBox, DateTextBox, ComboBox,
            Color, Point, webMercatorUtils, Graphic, InfoTemplate, VectorTileLayer, SpatialReference, SimpleLineSymbol, SimpleMarkerSymbol, PictureMarkerSymbol,
            BaseWidget, LayerInfos, LoadingIndicator,
            mapillaryUtils, MapillaryObjects, MapillaryMarkers, TagCloud,
            layersJson) {
    var addMapillaryLayerInfoIsVisibleEvent;

    layersJson = JSON.parse(layersJson);

    /**
     * Mapillary WebApp Builder Widget
     */
    return declare([BaseWidget, _WidgetsInTemplateMixin], {
        baseClass: 'mapillary',

        /**
         * Post Create
         */
        postCreate: function() {
            this.inherited(arguments);
            console.log('Mapillary::postCreate');
        },

        /**
         * Startup
         */
        startup: function() {
	        this.inherited(arguments);
	        console.log('Mapillary::startup');
	        this._initLoading();
	        if (!this.config.clientId || this.config.clientId === '')
	            this.noticeNode.innerHTML = '<a href="https://www.mapillary.com/app/settings/developers" target="_blank">Register for an App ID</a>';

	        this._createMapillaryViewer();
	        this._addMapillaryCoverageLayerToMap();
	        this.mapillaryObjects.createMapillaryObjectsLayer();
	        this._addMapillaryLayerInfoIsVisibleEventToMap();
	        this._addMapillaryClickEventToMap();

            /*
             * Mapillary Filters
             */
            topic.subscribe('MapillaryFilter', lang.hitch(this, this.filterMapillaryLayer));

            this.mapillary.on('nodechanged', this._onNodeChanged.bind(this));
            this.fromDate.on('change', lang.hitch(this, this._onFilterChange));
            this.toDate.on('change', lang.hitch(this, this._onFilterChange));
	        this.userList.on('remove', lang.hitch(this, this._onFilterChange));
	        this.userList.on('add', lang.hitch(this, this._onFilterChange));
            this.userSearch.on('keyup', lang.hitch(this, debounce(this._onUsernameKeyup, 300)));
            this.userSearch.on('change', lang.hitch(this, this._onUsernameChange));
            this.trafficSigns.on('change', lang.hitch(this, this._onFilterChange));
            this.coverage.on('change', lang.hitch(this, this._onFilterChange));
            this.form.on('submit', lang.hitch(this, this._onFilterChange));

            // set searchAttr and validator on users
            this.userSearch.set({
                validator: function() {
                    return true;
                },
                searchAttr: 'username'
            });

            /*
             * Bind LayerList and Traffic Signs setting
             */
            LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function(operLayerInfos) {
                operLayerInfos._finalLayerInfos.forEach(lang.hitch(this, function(layerInfo) {
                    if (layerInfo.id === 'Mapillary_Traffic_Signs') {
                        if (layerInfo._visible)
                            this.form.set('value', {
                                trafficSigns: ['on']
                            });
                        else
                            this.form.set('value', {
                                trafficSigns: null
                            });
                    }
                }));
            }));
        },

        /**
         * Get Form Values
         */
        getFormValues: function() {
            return lang.mixin({}, this.form.get('value'), {
                trafficsigns: this.trafficSigns.get('checked'),
                coverage: this.coverage.get('checked')
            });
        },

        /**
         * Resize
         */
        resize: function() {
            console.log('Mapillary::resize');
            this.mapillary.resize();
        },

	    /**
	     * Maximize
	     */
	    maximize: function() {
		    var isFullscreen = !domClass.contains(this.domNode, 'mini');
		    console.log('MapillaryViewer::maximize');
		    if (isFullscreen) {
			    domClass.remove(this.map.container, 'mini');
			    domClass.add(this.map.container, 'fullscreen');
			    domClass.remove(this.domNode, 'fullscreen');
			    domClass.add(this.domNode, 'mini');
			    domConstruct.place(this.minimizeNode, this.domNode);
			    domConstruct.place(this.maximizeNode, this.domNode);
		    } else {
			    domClass.remove(this.map.container, 'fullscreen');
			    domClass.add(this.map.container, 'mini');
			    domClass.remove(this.domNode, 'mini');
			    domClass.add(this.domNode, 'fullscreen');
			    domConstruct.place(this.minimizeNode, this.map.container);
			    domConstruct.place(this.maximizeNode, this.map.container);
		    }
		    this.emit('maximize');
		    topic.publish('MapillaryViewerMaximize');
		    this._resizeEvent();
	    },

	    /**
	     * Minimize
	     */
	    minimize: function() {
		    var isFullscreen = !domClass.contains(this.domNode, 'mini');
		    if (isFullscreen) {
			    domStyle.set(this.map.container, 'display', 'none'); //hide map
		    } else {
			    domQuery('.mly-wrapper', this.domNode).style('display', 'none'); //hide widget
		    }
		    domStyle.set(this.minimizeNode, 'display', 'none'); //hide minimize
		    domStyle.set(this.maximizeNode, 'display', 'none'); //hide maximize
		    this.emit('minimize');
		    topic.publish('MapillaryViewerMinimize');
		    this._resizeEvent();
	    },

	    /**
	     * Restore
	     */
	    restore: function() {
		    var isFullscreen = !domClass.contains(this.domNode, 'mini');
		    if (isFullscreen) {
			    domStyle.set(this.map.container, 'display', ''); //show map
		    } else
			    domQuery('.mly-wrapper', this.domNode).style('display', ''); //show widget
		    domStyle.set(this.minimizeNode, 'display', ''); //show minimize
		    domStyle.set(this.maximizeNode, 'display', ''); //show maximize
		    this.emit('restore');
		    topic.publish('MapillaryViewerRestore');
		    this.resize();
	    },

        /**
         * Toggle Viewer Visibility
         * @param val
         */
        toggleViewerVisibility: function(val) {
            var klaz = 'hide-viewer-content';

            if (val) {
                this.parentEl.classList.remove(klaz);
            } else {
                this.parentEl.classList.add(klaz);
            }
        },

        /**
         * Filter Mapillary Layer
         * Uses VectorTileLayer.setStyle to filter Mapillary layer
         * @param filters object <username,toDate,fromDate,panorama,segmentation>
         */
        filterMapillaryLayer: function(filters) {
            //https://www.mapbox.com/mapbox-gl-style-spec/#types-filter
            var layerStyle = lang.mixin({}, layersJson),
                validFilters = {},
                existingFilters,
                validFilterCount,
                filterLayers = layerStyle.layers.filter(function(layer) {
                    return ['mapillary-lines-highlight', 'mapillary-dots-highlight'].indexOf(layer.id) === -1;
                }),
                highlightLayers = layerStyle.layers.filter(function(layer) {
                    return ['mapillary-lines-highlight', 'mapillary-dots-highlight'].indexOf(layer.id) > -1;
                });

            //ensure filter values are not null, false, or an array in the case of a checkbox
            for (var filter in filters) {
                if (filters.hasOwnProperty(filter) && filters[filter] && filters[filter] !== '' && (filters[filter] instanceof Array ? filters[filter].length : true))
                    validFilters[filter] = filters[filter];
            }

            //show traffic signs layer
            if (validFilters.trafficSigns === 'true' || validFilters.trafficSigns === true)
                this.showMapillaryTrafficSignsLayer(validFilters.trafficSigns);
            else
                this.showMapillaryTrafficSignsLayer(false);

            //look for existing filters
            existingFilters = filterLayers.filter(function(layer) {
                return !!layer.filter;
            });

            validFilterCount = Object.keys(validFilters).length;
            if (validFilterCount > 0)
                filterLayers.forEach(function(layer) {
                    layer.filter = [];
                    if (validFilters.userList) {
                        var userFilter = ['in', 'userkey' ];
                        validFilters.userList.forEach(function(user) {
                            userFilter.push(user.id);
                        });
                        layer.filter.push(userFilter);
                    }
                    if (validFilters.fromDate)
                        layer.filter.push(['>=', 'captured_at', validFilters.fromDate.getTime()]);
                    if (validFilters.toDate)
                        layer.filter.push(['<=', 'captured_at', validFilters.toDate.getTime()]);
                    if (validFilters.panorama)
                        layer.filter.push(['==', 'panorama', true]);
                    if (validFilters.segmentation)
                        layer.filter.push(['==', 'segmentation', true]);

                    if (layer.filter.length)
                        layer.filter.unshift("all");
                    else
                        delete layer.filter;
                });
            else
                filterLayers.forEach(function(layer) {
                    delete layer.filter;
                });

            highlightLayers.forEach(function(layer) {
                switch (layer.id) {
                    case 'mapillary-dots-highlight':
                        layer.filter = ['==', 'sequenceKey', validFilters.sequenceKey || ''];
                        break;
                    case 'mapillary-lines-highlight':
                        layer.filter = ['==', 'key', validFilters.sequenceKey || ''];
                        break;
                    default:
                        break;
                }
            });

            if (validFilterCount || (validFilterCount === 0 && existingFilters.length > 0))
                this.layers.setStyle(layerStyle).then(function() {
                    console.log("MapillaryTheme::filterMapillaryLayer", validFilters, layerStyle);
                }, function(e) {
                    console.error("MapillaryTheme::filterMapillaryLayer", e, validFilters, layerStyle);
                });
        },

        /**
         * Show Mapillary Layer
         * @param visible boolean
         * @returns {*}
         */
        showMapillaryLayer: function(visible) {
            return this.map.getLayer('Mapillary').setVisibility(visible);
        },

        /**
         * Show Mapillary Traffic Signs Layer
         * Waits for the MapillaryViewer to be ready, then enables the Traffic Signs layer
         * @param visible boolean
         */
        showMapillaryTrafficSignsLayer: function(visible) {
            if (this.mapillaryObjects) {
                if (visible)
                    this.mapillaryObjects.show();
                else
                    this.mapillaryObjects.hide();
            }
        },

        /**
	     * Throw Resize Event
	     * @private
	     */
	    _resizeEvent: function() {
		    setTimeout(function() {
			    var event;
			    this.resize(); //in-case below fails
			    //ie 11
			    if (document.createEvent) {
				    event = document.createEvent('Event');
				    event.initEvent('resize', true, true);
			    } else
				    event = new Event('resize');

			    window.global.dispatchEvent(event);
		    }.bind(this), 0);
	    },

        /**
         * Create Mapillary Viewer
         */
        _createMapillaryViewer: function() {
            mapillaryUtils.setClientId(this.config.clientId);
            this.mapillary = mapillaryUtils.getViewer('mly');
            // Initialize MapillaryObjects Extension
            this.mapillaryObjects = new MapillaryObjects(this.mapillary, this.map, this.config.clientId, false);
            // Initialize MapillaryMarkers Extension
            this.mapillaryMarkers = new MapillaryMarkers(this.mapillary, this.map);

            // Hide Mapillary viewer
            this.parentEl = this.mapillary._container.element.parentElement;
            this.toggleViewerVisibility(false);
        },

        /**
         * Add Mapillary Coverage Layer to Map
         */
        _addMapillaryCoverageLayerToMap: function() {
            this.layers = new VectorTileLayer(layersJson);
            this.map.addLayer(this.layers);

            // TODO: if default...
            console.log('defaultCoverage = ', this.config.defaultCoverage);

            this.coverage.set('checked', this.config.defaultCoverage);
            this.layers.setVisibility(this.config.defaultCoverage);

            this.layers.on('error', function(err) {
                console.error(err.error);
            });
        },

        /**
         * Add Mapillary Click Event to Map
         */
        _addMapillaryClickEventToMap: function() {
	        if (this.mapClickEvent)
		        this.mapClickEvent.remove();
	        // Bind event to map click
	        return this.mapClickEvent = this.map.on('click', lang.hitch(this, function(event) {
		        if (event.which !== 1) //ignore middle/right click
			        return;
		        console.log('MapillaryViewer::mapClick', event);

		        var filter = this.getFormValues(),
			        currentGraphic = event.graphic,
			        lookAt,
			        lookAtPoint;

		        setTimeout(lang.hitch(this, function() {
			        if (!currentGraphic) {
				        this.loading.show();
				        this.restore();
				        lookAtPoint = webMercatorUtils.webMercatorToGeographic(event.mapPoint);
				        mapillaryUtils.lookAtPoint(lookAtPoint, filter).then(lang.hitch(this, function(res) {
					        if (res.features.length) {
						        this.mapillary.moveToKey(res.features[0].properties.key);
						        this.toggleViewerVisibility(true);
					        } else {
						        console.error('No images found.')
					        }
					        this.loading.hide();
				        }), lang.hitch(this, function(err) {
					        console.error(err);
					        this.loading.hide();
				        }));
			        } else {
				        this.loading.show();
				        this.restore();
				        switch (currentGraphic.type) {
					        case 'polygon':
					        case 'multipoint':
					        case 'polyline':
						        lookAt = currentGraphic.getExtent().getCenter();
						        break;
					        case 'extent':
						        lookAt = currentGraphic.getCenter();
						        break;
					        default:
					        case 'point':
						        lookAt = currentGraphic && currentGraphic.geometry;
						        break;
				        }
				        lookAtPoint = webMercatorUtils.webMercatorToGeographic(lookAt);
				        mapillaryUtils.lookAtPoint(lookAtPoint, filter).then(lang.hitch(this, function(res) {
					        var i = 0,
						        nearestImages = res.features.map(function(image) {
							        return image.properties.key;
						        }).filter(function(image) {
							        return ++i <= 10; //return top 10
						        });
                            /* If not clicking on a graphic, move to nearest */
					        if (nearestImages && !currentGraphic) {
						        return this.mapillary.moveToKey(nearestImages[0]);
                                /* Only move if the current image is not one of nearestImages*/
					        } else if (nearestImages.length && nearestImages.indexOf(this.mapillary._navigator.keyRequested$._value) === -1) {
						        // FIXME Sometimes the closest image is too close
						        return this.mapillary.moveToKey(nearestImages[0]);
					        } else {
						        var def = new Deferred();
						        def.resolve();
						        return def.promise;
					        }
				        }), lang.hitch(this, function() {
					        this.loading.hide();
				        })).then(lang.hitch(this, function() {
					        this.toggleViewerVisibility(true);
					        this.loading.hide();
				        }), lang.hitch(this, function(err) {
					        console.error(err);
					        this.loading.hide();
					        console.error('We couldn\'t load the data from the map, zoom in to the area that interests you an try clicking again');
				        }));
			        }
		        }), 0)
	        }));
        },

        /**
         * Add Mapillary LayerInfosIsVisible Event to Map
         * This event allows for the MapillaryFilter widget to update its Traffic Signs checkbox when the layer is made visible via the LayerList
         * @returns Deferred.promise
         */
        _addMapillaryLayerInfoIsVisibleEventToMap: function() {
            var def = new Deferred();
            LayerInfos.getInstance(this.map, this.map.itemInfo).then(function(operLayerInfos) {
                if (addMapillaryLayerInfoIsVisibleEvent)
                    addMapillaryLayerInfoIsVisibleEvent.remove();
                addMapillaryLayerInfoIsVisibleEvent = operLayerInfos.on('layerInfosIsVisibleChanged', function(changedLayerInfo) {
                    changedLayerInfo.forEach(function(layerInfo) {
                        if (layerInfo.id === 'Mapillary_Traffic_Signs') {
                            console.log('MapillaryTheme::_addMapillaryLayerInfoIsVisibleEventToMap', layerInfo.layerObject.visible);
                            topic.publish('MapillaryFilter', {
                                trafficSigns: layerInfo.layerObject.visible
                            });
                        }
                    });
                });
                def.resolve(operLayerInfos);
            });
            return def.promise;
        },

        /**
         * On Filter Change
         * @param e
         * @private
         */
        _onFilterChange: function(e) {
            e && typeof e.preventDefault === 'function' && e.preventDefault();
            var values = this.getFormValues();
            console.log('Mapillary::_onFilterChange', values);

            if (values.coverage !== undefined)
                this.layers.setVisibility(this.coverage.get('checked'));

            this.emit('mapillaryFilter', values);
            topic.publish('MapillaryFilter', values);
        },

	    /**
	     * On Username Change
	     * @param e
	     * @private
	     */
	    _onUsernameChange: function(e) {
		    var _user;
		    this.userSearch.store.data.forEach(lang.hitch(this, function(user) {
			    if (user.username === this.userSearch.get('value'))
				    _user = user;
		    }));
		    if (_user)
			    this.userList.addValue(_user);
		    this.userSearch.set('value', '');
		    this.userSearch.store.setData([]);
	    },

        /**
         * On Username Keyup
         * @param e
         * @private
         */
        _onUsernameKeyup: function(e) {
            var value = this.userSearch.get('displayedValue'),
                _getUser = function(searchResult) {
                    var user,
                        def = new Deferred();
                    if (searchResult.username.value) {
                        mapillaryUtils.getUser(searchResult.username.value).then(function(user) {
                            def.resolve({
                                id: user.user_uuid,
                                username: user.user
                            });
                        }, function(err) {
                            console.error(err);
                            def.reject(err);
                        });
                    } else {
                        def.resolve();
                    }
                    return def.promise;
                };
            mapillaryUtils.userFuzzySearch(value).then(lang.hitch(this, function(res) {
                var promises = [];
                if (value.length > 1) {
                    for (var i in res.jsonGraph.userFuzzySearch[value]) {
                        if (res.jsonGraph.userFuzzySearch[value].hasOwnProperty(i))
                            promises.push(_getUser(res.jsonGraph.userFuzzySearch[value][i]));
                    }
                }
                all(promises).then(lang.hitch(this, function(users) {
                    users = users.filter(function(user) {
                        return !!user;
                    });
                    console.log('MapillaryFilter::_onUsernameKeyup', value, users);
                    this.userSearch.set('store', new Memory({
                            data: users
                        })
                    );
                    if (users.length > 0)
                        this.userSearch.loadAndOpenDropDown();
                    else
                        this.userSearch.closeDropDown(true);
                }));
            }));
        },

        /**
         * On Mapillary Node Change
         * @param node
         */
        _onNodeChanged: function(node) {
            var lon = node.latLon.lon;
            var lat = node.latLon.lat;

            this.map.graphics.clear();
            this.toggleViewerVisibility(true);
            this.mapillary.resize();

            var pt = new Point(lon, lat, new SpatialReference({'wkid': 4326}));

	        this.directionSymbol = new PictureMarkerSymbol('widgets/Mapillary/images/icon-direction.png', 26, 52);
	        this.directionSymbol.setAngle(node.ca);

            var marker = new SimpleMarkerSymbol(
                SimpleMarkerSymbol.STYLE_CIRCLE,
                20,
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                    new Color([255, 255, 255]),
                    3),
                new Color([255, 134, 27]));

            this.map.graphics.add(new Graphic(
                webMercatorUtils.geographicToWebMercator(pt),
                marker,
                {'title': lon + ' ' + lat, 'content': 'A Mapillary Node'},
                new InfoTemplate('${title}', '${content}')
            ));
	        this.map.graphics.add(new Graphic(
		        webMercatorUtils.geographicToWebMercator(pt),
		        this.directionSymbol
	        ));
	        this.map.centerAt(pt);
	        topic.publish('mapillaryNodeChange', node);
        },

	    /**
	     * This function used for loading indicator
	     */
	    _initLoading: function () {
		    this.loading = new LoadingIndicator({
			    hidden: true
		    });
		    this.loading.placeAt(this.domNode);
		    this.loading.startup();
	    }

        // onOpen: function(){
        //   console.log('Mapillary::onOpen');
        // },

        // onClose: function(){
        //   console.log('Mapillary::onClose');
        // },

        // onMinimize: function(){
        //   console.log('Mapillary::onMinimize');
        // },

        // onMaximize: function(){
        //   console.log('Mapillary::onMaximize');
        // },

        // onSignIn: function(credential){
        //   console.log('Mapillary::onSignIn', credential);
        // },

        // onSignOut: function(){
        //   console.log('Mapillary::onSignOut');
        // },

        // onPositionChange: function(){
        //   console.log('Mapillary::onPositionChange');
        // }
    })
});
