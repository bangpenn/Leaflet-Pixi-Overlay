/**
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Igor Vladyka <igor.vladyka@gmail.com> (https://github.com/Igor-Vladyka/leaflet.motion)
**/

L.Motion = L.Motion || {
	Event: {
	  Started: 'motion-started',
	  Paused: 'motion-paused',
	  Resumed: 'motion-resumed',
	  Section: 'motion-section',
	  Ended: 'motion-ended',
	  Move: 'motion-move',
	},
  };
  
  L.motion = L.motion || {};
  L.Motion.Animate = {
	options: {
	  pane: 'polymotionPane',
	  attribution: '---------- © ' + new Date().getFullYear() + ' ',
	},
  
	motionOptions: {
	  auto: false,
	  easing: function (x) {
		return x;
	  }, // linear
	  speed: 0, // KM/H
	  duration: 0, // ms
	  startTime: new Date(), // Time
	},
  
	markerOptions: undefined,
  
	initialize: function (latlngs, options, motionOptions, markerOptions) {
	  L.Util.setOptions(this, options);
	  this.motionOptions = L.Util.extend({}, this.motionOptions, motionOptions || {});
	  this.markerOptions = L.Util.extend({}, markerOptions || {});
  
	  this._bounds = L.latLngBounds();
	  this._linePoints = this._convertLatLngs(latlngs);
	  if (!L.Motion.Utils.isFlat(this._linePoints)) {
		this._linePoints = this._linePoints[0];
	  }
  
	  this._initializeMarker();
	  this._latlngs = [];
	  L.Util.stamp(this); // Enforce proper animation order;
	},
  
	addLatLng: function (latLng, ring) {
	  latLng = L.Motion.Utils.toLatLng(latLng);
	  this._linePoints.push(latLng);
	  if (this._latlngs.length) {
		this._latlngs.push(latLng);
	  }
	  return this;
	},
  
	/**
		  @param {Map} map the Leaflet Map
	  */
	beforeAdd: function (map) {
	  if (!map.getPane(this.options.pane)) {
		map.createPane(this.options.pane).style.zIndex = 599;
	  }
  
	  this._renderer = map.getRenderer(this);
	},
  
	/**
		  @param {Map} map the Leaflet Map
		  @return {MotionObject} this
	  */
	onAdd: function (map) {
	  this._renderer._initPath(this);
	  this._reset();
	  this._renderer._addPath(this);
	  if (this.__marker && this.markerOptions.showMarker) {
		this.__marker.addTo(map);
	  }
  
	  if (this.__marker._icon && this.__marker._icon.children.length) {
		var baseRotationAngle = this.__marker._icon.children[0].getAttribute('motion-base');
		if (baseRotationAngle) {
		  this.__marker._icon.children[0].style.transform = 'rotate(' + baseRotationAngle + 'deg)';
		}
	  }
  
	  if (this.motionOptions.auto) {
		this.motionStart();
	  }
  
	  return this;
	},
  
	/**
		  @param {Map} map the Leaflet Map
	  */
	onRemove: function (map) {
	  this.motionStop();
	  if (this.__marker) {
		map.removeLayer(this.__marker);
	  }
  
	  this._renderer._removePath(this);
	},
  
	/**
		  @param {DateTime} startTime time from start animation
	  */
	_motion: function (startTime) {
	  var ellapsedTime = new Date().getTime() - startTime;
	  var durationRatio = 1; // 0 - 1
	  if (this.motionOptions.duration) {
		durationRatio = ellapsedTime / this.motionOptions.duration;
	  }
	  if (durationRatio < 1) {
		durationRatio = this.motionOptions.easing(durationRatio, ellapsedTime, 0, 1, this.motionOptions.duration);
		var nextPoint = L.Motion.Utils.interpolateOnLine(this._map, this._linePoints, durationRatio);
  
		let layer = this.getMarker();
		if (layer.options.icon) {
		  let id = layer.options.icon.options.id_point;
		  // titan.current[id] = nextPoint.predecessor
		}
  
		// for(var izc=0; izc<this._linePoints.length; izc++){
		// 	var lp = this._linePoints[izc].lat
		// 	if(lp.toString().includes("5.5141")){
		// 		titan.tmp.push([this._linePoints,nextPoint])
		// 	}
		// }
  
		L.Polyline.prototype.addLatLng.call(this, nextPoint.latLng);
		this._drawMarker(nextPoint.latLng);
  
		this.__ellapsedTime = ellapsedTime;
		this.animation = L.Util.requestAnimFrame(function () {
		  this._motion(startTime);
		}, this);
	  } else {
		this.motionStop(true);
	  }
	},
  
	/**
		  Draws marker according to line position
		  @param {LatLng} nextPoint next animation point
	  */
	_drawMarker: function (nextPoint) {
	  var marker = this.getMarker();
	  if (marker) {
		var prevPoint = marker.getLatLng();
  
		// [0, 0] Means that marker is not added yet to the map
		var initialPoints = this._linePoints[0];
		if (prevPoint.lat === initialPoints.lat && prevPoint.lng === initialPoints.lng) {
		  marker.addTo(this._map);
		  marker.addEventParent(this);
		} else {
		  if (marker._icon && marker._icon.children.length) {
			var needToRotateMarker = marker._icon.children[0].getAttribute('motion-base');
  
			if (needToRotateMarker) {
			  var motionMarkerOnLine = 0;
			  if (needToRotateMarker && !isNaN(+needToRotateMarker)) {
				motionMarkerOnLine = +needToRotateMarker;
			  }
  
			  marker._icon.children[0].style.transform = 'rotate(-' + Math.round(L.Motion.Utils.getAngle(prevPoint, nextPoint) + motionMarkerOnLine) + 'deg)';
			}
		  }
		}
		let nowPoint = marker.getLatLng();
		let heading = this._getHeadingMarker(nowPoint, nextPoint);
		let distance = this._GetDistance(nowPoint, nextPoint);
  
		marker.setLatLng(nextPoint);
		// Laporan.send("Bergerak dari posisi "+ prevPoint.lat +","+prevPoint.lng+ " bergerak ke posisi " + nextPoint.lat+","+nextPoint.lng, playerName, ObjectItem,nextPoint.lat,nextPoint.lng,Kecepatan,Health, 0);
		this.fire(L.Motion.Event.Move, { layer: this, distance: distance, heading: heading }, false);
	  }
	},
	_GetDistance(point1, point2) {
	  var x2 = (point2.lng - point1.lng) * (point2.lng - point1.lng);
	  var y2 = (point2.lat - point1.lat) * (point2.lat - point1.lat);
	  var dtmp = x2 + y2;
	  var d = Math.sqrt(dtmp);
	  return d * 111; // return kilometer
	},
	_getHeadingMarker: function (point, nextPoint) {
	  // get angle between two points
	  var angleInDegrees = (Math.atan2(point.lat - nextPoint.lat, point.lng - nextPoint.lng) * 180) / Math.PI;
  
	  // move heading north
	  let ang = 180 + angleInDegrees;
	  var sudut_arr = 0;
	  if (ang == 0) {
		sudut_arr = ang + 90;
	  }
	  if (ang > 0 && ang <= 90) {
		sudut_arr = 90 - ang;
	  }
	  if (ang > 90 && ang <= 180) {
		var a = ang - 90;
		sudut_arr = 360 - a;
	  }
	  if (ang > 180 && ang <= 270) {
		var a = ang - 180;
		sudut_arr = 270 - a;
	  }
	  if (ang > 270 && ang < 360) {
		var a = ang - 270;
		sudut_arr = 180 - a;
	  }
	  if (ang == 360) {
		sudut_arr = 90;
	  }
	  return sudut_arr;
	},
  
	/**
		  Removes marker from the map
	  */
	_removeMarker: function (animEnded) {
	  if (this.markerOptions && this.__marker) {
		if (!animEnded || this.markerOptions.removeOnEnd) {
		  this._map?.removeLayer(this.__marker);
		}
	  }
	},
  
	/**
		  Initialize marker from marker options and add it to the map if needed
	  */
	_initializeMarker: function () {
	  if (this.markerOptions) {
		this.__marker = L.marker(this._linePoints[0], this.markerOptions);
	  }
	},
  
	changeIcon: function (markerOptions) {
	  let marker = this.getMarker();
	  this._map?.removeLayer(this.__marker);
	  let prevPoint = marker.getLatLng();
	  this.__marker = L.marker(prevPoint, markerOptions).addTo(map);
	},
  
	/**
		  Starts animation of current object
	  */
	motionStart: function () {
	  if (this._map && !this.animation) {
		if (!this.motionOptions.duration) {
		  if (this.motionOptions.speed) {
			this.motionOptions.duration = L.Motion.Utils.getDuration(this._map, this._linePoints, this.motionOptions.speed);
		  } else {
			this.motionOptions.duration = 0;
		  }
		}
		this.setLatLngs([]);
		this._motion(new Date().getTime());
		this.fire(L.Motion.Event.Started, { layer: this }, false);
	  }
	  return this;
	},
  
	/**
		  Stops animation of current object
		  @param {LatLng[]} points full object points collection or empty collection for cleanup
	  */
	motionStop: function (animEnded) {
	  this.motionPause();
	  this.setLatLngs(this._linePoints);
	  this.__ellapsedTime = null;
	  this._removeMarker(animEnded);
	  this.fire(L.Motion.Event.Ended, { layer: this }, false);
  
	  return this;
	},
  
	/**
		  Pauses animation of current object
	  */
	motionPause: function () {
	  if (this.animation) {
		L.Util.cancelAnimFrame(this.animation);
		this.animation = null;
		this.fire(L.Motion.Event.Paused, { layer: this }, false);
	  }
  
	  return this;
	},
  
	/**
		  Resume animation of current object
	  */
	motionResume: function () {
	  if (!this.animation && this.__ellapsedTime) {
		if (!this.motionOptions.duration) {
		  if (this.motionOptions.speed) {
			this.motionOptions.duration = L.Motion.Utils.getDuration(this._map, this._linePoints, this.motionOptions.speed);
		  } else {
			this.motionOptions.duration = 0;
		  }
		}
		this._motion(new Date().getTime() - this.__ellapsedTime);
		this.fire(L.Motion.Event.Resumed, { layer: this }, false);
	  }
  
	  return this;
	},
  
	/**
		  Toggles animation of current object; Start/Pause/Resume;
	  */
	motionToggle: function () {
	  if (this.animation) {
		if (this.__ellapsedTime) {
		  this.motionPause();
		}
	  } else {
		if (this.__ellapsedTime) {
		  this.motionResume();
		} else {
		  this.motionStart();
		}
	  }
  
	  return this;
	},
  
	/**
		  Setup motion duration at any time
	  */
	motionDuration: function (duration) {
	  var prevDuration = this.motionSpeed.duration;
	  this.motionOptions.duration = duration || 0;
  
	  if (this.animation && prevDuration) {
		this.motionPause();
		this.__ellapsedTime = this.__ellapsedTime * (prevDuration / duration);
		this.motionOptions.duration = duration;
		this.motionResume();
	  }
	  return this;
	},
  
	/**
		  Setup motion speed at any time
	  */
	motionSpeed: function (speed) {
	  var prevSpeed = this.motionOptions.speed;
	  this.motionOptions.speed = speed || 0;
  
	  if (this.animation && prevSpeed) {
		this.motionPause();
		this.__ellapsedTime = this.__ellapsedTime * (prevSpeed / speed);
		this.motionOptions.duration = L.Motion.Utils.getDuration(this._map, this._linePoints, this.motionOptions.speed);
		this.motionResume();
	  }
  
	  return this;
	},
  
	/**
		  Returns current constructed marker
	  */
	getMarker: function () {
	  return this.__marker;
	},
  
	/**
		  Returns markers array from all inner layers without flattering.
	  */
	getMarkers: function () {
	  return [this.getMarker()];
	},
  };
  