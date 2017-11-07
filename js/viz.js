$(document).ready(function(){
        $('#start').click(function(){
          $('#welcomePopUp').fadeOut(1000);
        });
        $('li.lingkungan').click(function(){
          $('.setLing').show();
          $('#slideInfo').hide();
        });
        $('li.infoZona').click(function(){
          $('#slideInfo').show();
          $('.setLing').hide();
        });
        $('li.tentang').click(function(){
          $('#welcomePopUp').show();
          $('.setLing, #slideInfo').hide();
        });
        $('#legendBtn').click(function(){
          $('#legend').show();
          $('#filter, #chartDiv, #chartTxt').hide();
        });
        $('#filterBtn').click(function(){
          $('#filter').show();
          $('#legend, #chartDiv, #chartTxt').hide();
        });
        $('#chartBtn').click(function(){
          $('#chartDiv, #chartTxt').show();
          $('#legend, #filter').hide();
        });
      });
