// Zoning Bukittinggi 3D App code
// Written by: Lusi Suwandi @ esriindonesia
// Version 1.0 - 2017

require([
  "esri/Map",
  "esri/WebMap",
  "esri/views/SceneView",
  "esri/layers/FeatureLayer",
  "esri/layers/SceneLayer",
  "esri/widgets/Legend",
  "esri/widgets/LayerList",
  "esri/widgets/Home",
  "esri/widgets/BasemapToggle",
  "dojo/domReady!"
], function(Map, WebMap, SceneView, FeatureLayer, SceneLayer, Legend, LayerList, Home, BasemapToggle) {

  var map = new WebMap({
    portalItem: {
      id: "02da3d4b3b3b4b26a1b8d541697199d6"
    },
    basemap: "gray-vector",
    ground: "world-elevation"
  });

  //bikin sceneview
  var view = new SceneView({
    container: "viewDiv",
    map: map,
    center: [100.373654, -0.302975],
    camera: {
      position: [100.373654, -0.302975, 1500],
      tilt: 70,
      heading: 50
    },
    popup: {
      dockEnabled: false,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: false
      }
    }
  });



  // kasih environment di SceneView
  view.environment = {
    lighting: {
      directShadowsEnabled: true,
      date: new Date("Sun Nov 5 2017 09:00:00 GMT+0700 (UTC)")
    }
  };

  function updateTimeOfDay(){
    var date = $('#waktu').val();
    view.environment.lighting.date = new Date(date);
  }

  // mengganti waktu untuk pencahayaan
  $('#waktu').change(updateTimeOfDay);


  function updateShadow(){
    var shadow = $('#bayangan').val();
    if (shadow == "true") {
      view.environment.lighting.directShadowsEnabled = true;
    } else {
      view.environment.lighting.directShadowsEnabled = false;
    }
  }

  // ganti setting bayangan
  $('#bayangan').change(updateShadow);


  //kasih logo bukittinggi di ui
  view.ui.add(logo, "bottom-right");

  var layerList = new LayerList({
    view: view
  });

  view.ui.add(layerList, {
    position: "bottom-left"
  });

  // bikin widget home
  var homeWidget = new Home({
    view: view
  });

  view.ui.add(homeWidget, "top-left");

  var legend = new Legend({
    view: view,
    container: "legend"
  });

  var toggle = new BasemapToggle({
    view: view,
    nextBasemap: "hybrid"
  });

  view.ui.add(toggle, "top-left");

  //scenelayer untuk bangunan eksisting
  var bangunan = new SceneLayer({
    url: "https://tiles.arcgis.com/tiles/8Y7Trd8yKyEknquW/arcgis/rest/services/building_BKT_2/SceneServer",
    popupEnabled: true,
    title: "Bangunan (Eksisting)",
    visible: true
  });


  var polaTemplate = {
    title: "Info Zonasi",
    content: "<table><tr><td>BWP</td><td>{BWP}</td></tr>" +
    "<tr><td>Blok</td><td>{BLOK}</td></tr>"+
    "<tr><td>Kode</td><td>{KODE}</td></tr>"+
    "<tr><td>Zona</td><td>{ZONA_1}</td></tr>"+
    "<tr><td>Sub Zona</td><td>{SUB_ZONA}</td></tr>"+
    "<tr><td>Koefisien Dasar Bangunan (KDB) Maksimum</td><td>{KDBmax}</td></tr>"+
    "<tr><td>Koefisien Lantai Bangunan (KLB)</td><td>{KLB}</td></tr>"+
    "<tr><td>Ketinggian Bangunan (KB)</td><td>{KB} Lantai</td></tr>"+
    "<tr><td>Koefisien Dasar Hijau (KDH)</td><td>{KDH}</td></tr>"+
    "</table>",
    fieldInfos: [
      {
        fieldName: "BWP"
      },
      {
        fieldName: "BLOK"
      },
      {
        fieldName: "KODE"
      },
      {
        fieldName: "ZONA_1"
      },
      {
        fieldName: "SUB_ZONA"
      },
      {
        fieldName: "KDBmax"
      },
      {
        fieldName: "KLB"
      },
      {
        fieldName: "KB"
      },
      {
        fieldName: "KDH"
      },
    ]
  };

  var polaRuang3d = new SceneLayer({
    url: "https://services9.arcgis.com/8Y7Trd8yKyEknquW/ArcGIS/rest/services/Ruang_BKT/SceneServer/layers/0",
    popupEnabled: true,
    popupTemplate: polaTemplate,
    title: "Pola Ruang (3D)",
    visible: false,
    popupEnabled: true
  });


  //bikin filter untuk zona 3d
  function updateFilter(){
    var filterVal = $('#filterZona').val();
    var polaDef = "ZONA_1 =" + "'" + filterVal + "'";
    if (filterVal == "ANY"){
      polaRuang3d.definitionExpression = "ZONA_1 = ANY";
    } else {
      polaRuang3d.definitionExpression = polaDef;
    }
  }

  $('#filterZona').change(updateFilter);

  var tree = new FeatureLayer({
    url: "https://services9.arcgis.com/8Y7Trd8yKyEknquW/arcgis/rest/services/trees_bkt/FeatureServer/0",
    popupEnabled: false,
    visible: true,
    listMode: "hide"
  });


  map.addMany([bangunan, polaRuang3d, tree]);

  var symbolBangunan = {
    type: "mesh-3d",
    symbolLayers: [{
      type: "fill",
      material: { color: [255, 255, 255, 1] }
    }]
  };

  bangunan.renderer = {
    type: "simple",
    symbol: symbolBangunan
  };



  var symbolPolaRuang3d = {
    type: "mesh-3d",
    symbolLayers: [{
      type: "fill",
      material: { color: [255, 255, 255, 0.7] }
    }]
  };

  polaRuang3d.renderer = {
    type: "simple",
    symbol: symbolPolaRuang3d
  };

  var symbolTree = {
    type: "web-style",
    name: "Acer",
    styleName: "esriThematicTreesStyle"
  };

  tree.renderer = {
    type: "simple",
    symbol: symbolTree,
    visualVariables: [
          {
            type: "size",
            axis: "height",
            minSize: 7,
            minSize: 12,
            valueUnit: "feet"
          }]
  };



});
