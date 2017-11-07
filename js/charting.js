// Zoning Bukittinggi 3D App code
// Written by: Lusi Suwandi @ esriindonesia
// Version 1.0 - 2017
// Charting.js for chart making with ArcGIS API for JS and AmChart

require([
  "esri/tasks/QueryTask",
  "esri/tasks/support/Query",
  "esri/tasks/support/StatisticDefinition",

  "dojo/domReady!"
], function(QueryTask, Query, StatisticDefinition) {

  var queryZoningTask = new QueryTask({
    url: "https://services8.arcgis.com/TWq7UjmDRPE14lEV/arcgis/rest/services/Rencana_Pola_Ruang/FeatureServer/0"
  });

  var queryArea = new Query();
  var statisticDefinitionArea = new StatisticDefinition();

  statisticDefinitionArea.statisticType = "sum";
  statisticDefinitionArea.onStatisticField = "Shape__Area";
  statisticDefinitionArea.outStatisticFieldName = "CountArea";
  queryArea.where = "1=1";
  queryArea.outFields=["ZONA_1"];
  queryArea.groupByFieldsForStatistics = ["ZONA_1"];
  queryArea.orderByFields=["ZONA_1"];
  queryArea.outStatistics = [statisticDefinitionArea];

  queryZoningTask.execute(queryArea).then(function(result){

    console.log(result);

    //Crate variable for query result array untuk yang query area nich
    var labelArea = [];
    var dataArea = [];
    // var zonaName = [];
    // var kode = [];


    //create loop for every result
    for (i = 0; i < result.features.length; i++) {
      console.log(result.features[i].attributes.CountArea);
      // console.log(result.features[i].attributes.SUB_ZONA);
      console.log(result.features[i].attributes.ZONA_1);
      // console.log(result.features[i].attributes.KODE);

      //push result to variable array
      dataArea.push(result.features[i].attributes.CountArea);
      // labelArea.push(result.features[i].attributes.SUB_ZONA);
      labelArea.push(result.features[i].attributes.ZONA_1);
      // kode.push(result.features[i].attributes.KODE);
    }

    var pieData = [];

    var color={};

    color["Zona Perumahan"]="#ffc97a";
    color["Zona Perdagangan dan Jasa"]="#e5001c";
    color["Zona Sarana Pelayanan Umum"]="#511124";
    color["Zona RTH"]="#258e4b";
    color["Zona Perlindungan Setempat"]="#00590c";
    color["Zona Perkantoran"]="#8401c1";
    color["Pertanian Lahan Kering"]="#acff91";
    color["Pertanian Lahan Basah"]="#caf9f7";
    color["Zona Khusus"]="#406833";
    color["Zona Pariwisata"]="#fcc9fb";
    color["Zona Peruntukkan Campuran"]="#253966";

    // color["Sempadan Ngarai Sianok"]="#00590c";
    // color["Kawasan Ngarai Sianok"]="#019915";
    // color["Sempadan Sungai"]="#02d0db";
    // color["Taman Kota"]="#258e4b";
    // color["Hutan Kota"]="#258e4b";
    // color["Jalur Hijau"]="#094c22";
    // color["Tempat Pemakaman Umum"]="#4fffb5";
    // color["Perumahan Kepadatan Tinggi"]="#ff9900";
    // color["Perumahan Kepadatan Sedang"]="#ffc97a";
    // color["Perumahan Kepadatan Rendah"]="#fffc79";
    // color["Zona Perdagangan dan Jasa Skala Regional"]="#59000b";
    // color["Zona Perdagangan dan Jasa Skala Kota"]="#e5001c";
    // color["Zona Perdagangan dan Jasa Skala Lokal"]="#ff1935";
    // color["Pendidikan Tinggi"]="#000360";
    // color["Pendidikan Menengah"]="#151aa5";
    // color["Pendidikan Dasar"]="#353be8";
    // color["Kantor Pemerintah"]="#5a0084";
    // color["Kantor Swasta"]="#8401c1";
    // color["Transportasi Skala Regional"]="#070707";
    // color["Transportasi Skala Kota"]="#444444";
    // color["Transportasi Skala Lokal"]="#b5b5b5";
    // color["Kesehatan Skala Regional"]="#47042a";
    // color["Kesehatan Skala Kota"]="#044f0c";
    // color["Kesehatan Skala Lokal"]="#030742";
    // color["Olahraga"]="#c47daf";
    // color["Sosial Budaya"]="#511124";
    // color["Peribadatan"]="#033a12";
    // color["Pariwisata"]="#fcc9fb";
    // color["Pertanian Lahan Basah"]="#caf9f7";
    // color["Pertanian Lahan Kering"]="#acff91";
    // color["Pertahanan Keamanan"]="#406833";
    // color["Perumahan, Perkantoran, Perdagangan Dan Jasa"]="#253966";

    for (i = 0; i < labelArea.length; i++){
      pieData.push({
        "Zone" : labelArea[i],
        "Area" : dataArea[i],
        "Color": color[labelArea[i]]
      })
    }

    console.log(pieData);


    var chart = AmCharts.makeChart("chartDiv", {
      "type": "pie",
      "dataProvider": pieData,
      "marginBottom": 0,
	    "marginTop": 0,
      "valueField": "Area",
      "titleField": "Zone",
      "colorField": "Color",
      "pieX": "50%",
	    "pieY": "35%",
      "labelRadius": 3,
      "labelTickAlpha": 1,
      "fontSize" : 6,
      "labelColorField": "color",
      "balloon": {
        "fixedPosition": true
      },
      "legend": {
		"enabled": false,
		"align": "center",
		"markerType": "circle",
    "maxColumns": 6,
    "fontSize": 8,
    "valueText": ""
	}
    });


  });






});
