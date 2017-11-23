/* globals define */

define([
    'dojo/_base/declare',
    'dojo/_base/lang',

    'dojo/promise/all',
    'dijit/form/CheckBox',
    'dojo/dom',
    'dojo/on',
    'dojo/topic',

    '../mapillaryUtils',

    'esri/geometry/Extent',
    'esri/SpatialReference',
	'esri/Color',
    'esri/geometry/Point',
    'esri/tasks/query',
	'esri/geometry/webMercatorUtils',
	'esri/graphic',
	'esri/symbols/SimpleLineSymbol',
	'esri/symbols/SimpleMarkerSymbol',
	'esri/symbols/PictureMarkerSymbol'
], function(declare, lang, all, CheckBox, dom, on, topic,
            mapillaryUtils,
            Extent, SpatialReference, Point, Color, Query, webMercatorUtils, Graphic, SimpleLineSymbol, SimpleMarkerSymbol, PictureMarkerSymbol) {

    function shadeColor(color, percent) {
        var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
        return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
    }

    /**
     * MapillaryObjects
     * @class MapillaryObjects
     */
    return declare(null, {
        hoverColor: '#f80',
        /**
         * Constructor
         * @param viewer
         * @param map
         */
        constructor: function(viewer, map) {
            this.map = map;
            this.markerComponent = viewer.getComponent('marker');
            this.viewer = viewer;
            this.node = false;
            this._query = {};
            this._events = [];
            this._layerEvents = {};
            this._layerColors = {};
            this._layers = [];

            function initCallback(r) {
                this.init()
            }

            this.markerComponent
                .activated$
                .filter(function(activated) {
                    return activated
                })
                .first()
                .subscribe(initCallback.bind(this))
        },

        /**
         * Init
         */
        init: function() {
            this._layers = this.map.graphicsLayerIds.map(lang.hitch(this, function(l) {
                return this.map.getLayer(l)
            }));

            //this._addMapillaryHoverIndicatorMarker();

            // Add layer event handlers
            this._layers.forEach(this._addLayerEvents.bind(this));

            // Add Viewer event handlers

            this._events.push(this.viewer.on(mapillaryUtils.Mapillary.Viewer.click, lang.hitch(this, this._onViewerMouseClick)));
            this._events.push(this.viewer.on('nodechanged', this._onNodeChangedCallback.bind(this)));
	        this._events.push(this.viewer.on('bearingchanged', this._onBearingChanged.bind(this)));

            // Add Map event handlers
            this._events.push(this.map.on('mouse-move', this._mapMouseMoveCallback.bind(this)));

        },

        /**
         * Destroy
         */
        destroy: function() {
            this._events.forEach(function(e) {
                e && typeof e.remove === 'function' && e.remove();
            });
        },

        /**
         * Create Mapillary Hover Indicator Marker
         * @private
         */
        _addMapillaryHoverIndicatorMarker: function() {
            // Show a flat circle marker in the viewer when hovering the ground in the viewer
            var indicatorMarker = null;
            var indicatorMarkerId = "indicator-id";
            var dragging = false;
            var markerComponent = this.markerComponent;
            var lastPos = null;
            var setIndicator = function(latLon) {
                indicatorMarker = new mapillaryUtils.Mapillary.MarkerComponent.CircleMarker(
                    indicatorMarkerId,
                    latLon,
                    {color: '#0f0'});

                markerComponent.add([indicatorMarker]);
            };

            var removeIndicator = function() {
                if (!!indicatorMarker && markerComponent.has(indicatorMarker.id)) {
                    markerComponent.remove([indicatorMarker.id]);
                    indicatorMarker = null;
                }
            };

            var moveIndicator = function(latLon) {
                if (dragging) {
                    return;
                }

                if (!latLon) {
                    removeIndicator();
                } else {
                    setIndicator({lat: latLon.lat, lon: latLon.lon});
                }
            };

            var onViewerMouseEvent = function(event) {
                lastPos = event.pixelPoint;
                moveIndicator(event.latLon);
            };

            // Listen to viewer mouse events
            this._events.push(this.viewer.on(mapillaryUtils.Mapillary.Viewer.mouseup, onViewerMouseEvent));
            this._events.push(this.viewer.on('mousemove', onViewerMouseEvent));
            this._events.push(this.viewer.on(mapillaryUtils.Mapillary.Viewer.mousedown, onViewerMouseEvent));
        },

        /**
         * Add Layer Events
         * @param layer
         * @private
         */
        _addLayerEvents: function(layer) {
            this._layerEvents[layer.id] = [
                layer.on('visibility-change', lang.hitch(this, function(e) {
                    this._layerVisibilityChangeCallback(layer, e.visible);
                }))
            ];
        },

        /**
         * Remove Layer Events
         * @param layer
         * @private
         */
        _removeLayerEvents: function(layer) {
            if (this._layerEvents[layer.id])
                this._layerEvents[layer.id].forEach(function(e) {
                    e && typeof e.remove === 'function' && e.remove();
                });
            this._layerEvents[layer.id] = null;
            delete this._layerEvents[layer.id];
        },

        /**
         * Get Layer Color
         * @param layerId
         * @returns {*}
         */
        getLayerColor: function(layerId) {
            if (!this._layerColors[layerId])
                this._layerColors[layerId] = '#' + (Math.random()*0xFFFFFF<<0).toString(16);
            return this._layerColors[layerId];
        },

        /**
         * Update Markers Around
         * @param queriedFeatures
         * @param callback
         */
        updateMarkersAround: function(queriedFeatures, callback) {
            // FIXME promise helpers
            function reflect(promise) {
                return promise.then(function(v) {
                        return {state: 'fulfilled', value: v}
                    },
                    function(e) {
                        return {state: 'rejected', error: e}
                    })
            }

            function settle(promises) {
                var actualPromises = promises.filter(function(p) {
                    if (!!p) return p
                });
                if (actualPromises) {
                    return all(actualPromises.map(reflect))
                } else {
                    return all([])
                }
            }

            var _markerComponent = this.markerComponent;
            var _this = this;

            console.log('MapillaryObjects::updateMarkersAround', queriedFeatures);
            // Query features (promise-all)
            settle(queriedFeatures)
            // flatten features
                .then(function(v) {
                    var features = v
                        .map(function(x) {
                            return x.value
                        })
                        .filter(function(l) {
                            return l && l.features
                        })
                        .map(function(l) {
                            if (l.features) {
                                return l.features
                            } else {
                                return []
                            }
                        });
                    return [].concat.apply([], features)
                })
                // Process features into markers
                .then(function(data) {
                    console.log('MapillaryObjects::updateMarkersAround', data);
                    // Process data
                    return data.map(lang.hitch(_this, _this.createFeatureMarker))
                })
                // Add Markers to the viewer
                .then(function(markers) {
                    markers.forEach(function(m) {
                        setTimeout(function() {
                            _markerComponent.add([m]);
                        }, 0)
                    });

                    if (callback) {
                        callback()
                    }
                })
        },

        /**
         * Create Feature Marker
         * @param feature
         * @param options
         * @private
         */
        createFeatureMarker: function(feature, options) {
            options = typeof options === 'object' ? options : {};
            if (feature._layer.objectIdField) {
                feature.attributes.OBJECTID = feature.attributes[feature._layer.objectIdField];
            } else if (!feature.attributes.OBJECTID) {
                console.warn('FeatureLayer does not have an OBJECTID. Guessing ID field.');
                for (var i in feature.attributes) {
                    if (feature.attributes.hasOwnProperty(i) && feature.attributes[i] && i.toUpperCase() === i) {
                        feature.attributes.OBJECTID = feature.attributes[i];
                        break;
                    }
                }
            }
            var id = feature.attributes.OBJECTID + ':' + feature._layer.id;
            var geometry = feature.geometry.type === 'point' ? feature.geometry : feature.geometry.getExtent().getCenter();
            var lat = options.lat || (geometry && geometry.getLatitude());
            var lon = options.lon || (geometry && geometry.getLongitude());
            var color = this.getLayerColor(feature._layer.id);

            delete options['lat'];
            delete options['lon'];

            var marker = new mapillaryUtils.Mapillary.MarkerComponent.SimpleMarker(
                id,
                {lat: lat, lon: lon},
                lang.mixin({
                    color: (color || '#FFFFFF'),
                    opacity: 0.9,
                    ballColor: '#FFFFFF',
                    ballOpacity: 1,
                    radius: 0.7,
                    interactive: false
                }, options)
            );
            // store layer on marker so that we can sort markers by layer for visibility changes
            marker._feature = feature;
            marker._layer = feature._layer;
            console.log('MapillaryObjects::createFeatureMarker', marker, feature, options);
            return marker;
        },

        /**
         * Create Spatial Query
         * @param lat
         * @param lon
         * @returns {*}
         */
        createSpatialQuery: function(lat, lon) {
            var diff = 0.001;
            var extent = new Extent(lon - diff, lat - diff,
                lon + diff, lat + diff,
                new SpatialReference({wkid: 4326}));

            var query = new Query();
            query.geometry = extent;
            return query
        },

        /**
         * On Mapillary Node Change
         * @param node
         * @param callback
         * @returns {boolean}
         * @private
         */
        _onNodeChangedCallback: function(node, callback) {
            if (!node) {
                console.error('No current node in _onNodeChangedCallback');
                return false;
            }
            this.node = node;
            console.log('MapillaryViewer::MapillaryObjects::_onNodeChangedCallback', node);
            if (this.node && this._query[node.latLon.lat + '' + node.latLon.lon]) {
                callback && callback(this._query[node.latLon.lat + '' + node.latLon.lon]);
                return;
            }

	        //this.map.graphics.clear();
	        this.viewer.resize();

	        var pt = new Point(node.latLon.lon, node.latLon.lat, new SpatialReference({'wkid': 4326}));

	        this.directionSymbol = new PictureMarkerSymbol('widgets/Mapillary/images/icon-direction.png', 26, 52);
	        this.directionSymbol.setAngle(node.ca);

	        var marker = new SimpleMarkerSymbol(
		        SimpleMarkerSymbol.STYLE_CIRCLE,
		        20,
		        new SimpleLineSymbol(
			        SimpleLineSymbol.STYLE_SOLID,
			        new Color([255, 255, 255]),
			        3
		        ),
		        new Color([255, 134, 27])
	        );

	        this.map.graphics.add(new Graphic(
		        webMercatorUtils.geographicToWebMercator(pt),
		        marker
	        ));
	        this.map.graphics.add(new Graphic(
		        webMercatorUtils.geographicToWebMercator(pt),
		        this.directionSymbol
	        ));

	        var query = this.createSpatialQuery(node.latLon.lat, node.latLon.lon);
            var queriedFeatures = this._layers.map(function(l) {
                if (l.queryFeatures) {
                    return l.queryFeatures(query);
                } else {
                    return;
                }
            });
            console.log(this._layers, queriedFeatures);
            this._query[node.latLon.lat + '' + node.latLon.lon] = queriedFeatures;
            this.updateMarkersAround(queriedFeatures, function() {
                callback && callback(queriedFeatures);
            }.bind(this));

            this.query = query; // Save query for reuse
        },

        /**
         * Map Mouse Move Callback
         * @param e
         * @private
         */
        _mapMouseMoveCallback: function(e) {
            this.mapPoint = e.mapPoint;
        },

	    /**
	     * On Bearing Change
	     * @param num
	     * @private
	     */
	    _onBearingChanged: function(num) {
		    this.directionSymbol.setAngle(num);
		    this.map.graphics.refresh();
	    },

        /**
         * on Viewer Mouse Click
         * @param e
         * @private
         */
        _onViewerMouseClick: function(e) {
            if (!e || !e.target)
                return;

            if (!e.latLon) { return; }

            this.markerComponent.getMarkerIdAt(e.pixelPoint).then(lang.hitch(this, function(markerId) {
                // Only create a new marker if no interactive markers are hovered
                if (markerId !== null) {
                    return;
                }

                setTimeout(lang.hitch(this, function() {
                    var pt = new Point(e.latLon.lon, e.latLon.lat);
                    topic.publish('MapillaryViewerAdd', {
                        geometry: pt
                    });
                }, 0));
            }));
        },

        /**
         * Layer Visibility Change
         * @param layer object
         * @param visible boolean
         * @private
         */
        _layerVisibilityChangeCallback: function(layer, visible) {
            setTimeout(lang.hitch(this, function() {
                var allMarkers = this.markerComponent.getAll(),
                    _getLayerMarkers = function(layerId) {
                        return allMarkers.filter(function(marker) {
                            console.log(marker._layer);
                            return marker && marker._layer && marker._layer.id === layerId;
                        });
                    },
                    layerMarkers = _getLayerMarkers(layer.id);
                console.log('MapillaryViewer::MapillaryObjects::_layerVisibilityChangeCallback', layer, layerMarkers);
                if (!visible) {
                    this.markerComponent.remove(layerMarkers.map(function(marker) {
                        return marker._id;
                    }));
                }
                delete this._query[this.node.latLon.lat + '' + this.node.latLon.lon];
                this._onNodeChangedCallback(this.node);
            }), 500);
        }
    })
});