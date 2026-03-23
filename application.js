// state
state = {
  areas: new Map(),
  allcountries: new Set(),
  demo: [],
  geolayer: [],
  maxage: 120,
  pops: new Map(),
  quartieri: new Set(),
  sections: new Map(),
  filters: {
    ages : {
      min: 0,
      max: 120
    },
    areas: new Set(),
    countries: new Set(),
    sections: new Set(),
    sex: new Set([1,2]),
    subvariable: "absolute"
  },
  colors: {
    bg: `#000000`,
    fg: `#D1D0D0`,
    hl: `#CFB53B`
  }
}

// loading
async function loadAreas() {
    const response = await fetch('./areas.json');
    const content = await response.json();
    state.areas = new Map(Object.entries(content));
    state.allcountries = new Set([...state.areas.values()].flat()).add('Italy');
}

async function loadCenssec() {
  const response = await fetch('./sections.json');
  const content = await response.json();
  state.sections = new Map(Object.entries(content));
  state.sections.set('Inabitate',new Set())
  state.quartieri = new Set([...state.sections.keys()]); 
}

async function loadDemo() {
    const response = await fetch('./pop26.json'); 
    const content = await response.json();
    state.demo = aq.from(content.data);
    state.maxage = state.demo.rollup({max: aq.op.max('eta')}).get('max',0);
}

async function loadMapData() {
  const response = await fetch('./sezioni.json')
  return await response.json()
}

// calculating
function calculateSectionsPop() {
  let counts = state.demo.groupby('nsez').rollup({count: aq.op.count()}); 
  state.pops = new Map(counts.array('nsez').map((c,i) => [c,counts.array('count')[i]]));
}

/*====================================================================================================*/
// gui
function lighton(button) {
    button.style.color = state.colors.hl;
    button.style.borderColor = state.colors.hl;
  }

function lightoff(button) {
  button.style.color = state.colors.fg;
  button.style.borderColor = state.colors.fg;
}

/*====================================================================================================*/
function setupAgeSlider() {
  const agemin = document.getElementById('age-min');
  // all'inizio sono selezionate tutte le età
  agemin.style.background = `linear-gradient(to right,
                            ${state.colors.fg} 0%, 
                            ${state.colors.fg} 100%)`;  
  const agemax = document.getElementById('age-max');
  const label = document.getElementById('age-range-label');
  agemin.max = state.maxage;
  agemax.max = state.maxage;
  agemax.value = state.maxage;
  const updateRange = () => {
    if (parseInt(agemin.value)>parseInt(agemax.value)) {
      let temp = agemin.value;
      agemin.value = agemax.value;
      agemax.value = temp;      
    }
    label.textContent = `Intervallo d'età: ${agemin.value} - ${agemax.value}`;
    state.filters.ages.min = parseInt(agemin.value);
    state.filters.ages.max = parseInt(agemax.value);    
    const permin = (agemin.value/state.maxage)*100+0.1;
    const permax = (agemax.value/state.maxage)*100-0.1;
    agemin.style.background = `linear-gradient(to right,
                              ${state.colors.bg} 0%, 
                              ${state.colors.bg} ${permin}%, 
                              ${state.colors.fg} ${permin}%, 
                              ${state.colors.fg} ${permax}%, 
                              ${state.colors.bg} ${permax}%, 
                              ${state.colors.bg} 100%)`;  
    applyFilters(); 
  }
  agemin.oninput = updateRange;
  agemax.oninput = updateRange; 
}

function setupSex() {
  const males = document.getElementById('sex-males');
  const females = document.getElementById('sex-females');
  
  if (state.filters.sex.has(1)) {
    lighton(males);
  }
  else {
    lightoff(males);     
  }
  if (state.filters.sex.has(2)) {
    lighton(females); 
  }
  else {
    lightoff(females);
  }

  males.addEventListener('click',() => {
    if (state.filters.sex.has(1)) {
      state.filters.sex.delete(1);
      lightoff(males);
    }
    else {
      state.filters.sex.add(1);
      lighton(males);
    }
    applyFilters(); 
  });

  females.addEventListener('click',() => {
    if (state.filters.sex.has(2)) {
      state.filters.sex.delete(2);
      lightoff(females);
    }
    else {
      state.filters.sex.add(2);
      lighton(females);
    }
    applyFilters(); 
  });
}

/*====================================================================================================*/
function updateAppearance() {
  if (state.filters.sections.size == 0) {
    lighton(document.getElementById('quartieri-deselect-all'));
    lightoff(document.getElementById('quartieri-select-all'));
    state.quartieri.forEach((q) => {
      lightoff(document.getElementById(q));
    });
    return; 
  }
  else {
    lightoff(document.getElementById('quartieri-deselect-all'));
  }

  let all = true;
  for (const [key,values] of state.sections) {    
    let button = document.getElementById(key);
    let set = new Set([...values]);
    if (set.isSubsetOf(state.filters.sections)) {
      lighton(button);           
    }
    else {
      all = false; 
      lightoff(button);
    }         
  }

  if (all) {
    lighton(document.getElementById('quartieri-select-all'));
  }
  else {
    lightoff(document.getElementById('quartieri-select-all'))
  }
}

function setupButton(q) {
  const button = document.getElementById(q);
  button.addEventListener("click",() => {
      let set = new Set(state.sections.get(q));
      let issubset = set.isSubsetOf(state.filters.sections); 
      state.geolayer.eachLayer((layer) => {
        let section = layer.feature.properties.SEZ21;
        if (set.has(section)) {
          if (issubset) {
            state.filters.sections.delete(section);
            layer.setStyle(basicSectionStyle(layer.feature)); 
          }
          else if (!state.filters.sections.has(section)) {
            state.filters.sections.add(section);
            layer.setStyle(stressSection(layer.feature));
          }
        }
      });
      updateAppearance();
      applyFilters(); 
  });
}

function setupLeftCentral() {
  const selectall = document.getElementById('quartieri-select-all');
  const deselectall = document.getElementById('quartieri-deselect-all');

  const container = document.getElementById("quartieri");
  state.quartieri.forEach((q) => {
    let button = document.createElement("button");
    button.id = q; 
    button.textContent = q;
    container.append(button); 
  });
  state.quartieri.forEach((q) => {
    setupButton(q);
  });

  selectall.addEventListener('click',() => { 
    state.geolayer.eachLayer((layer) => {
      state.filters.sections.add(layer.feature.properties.SEZ21); 
      layer.setStyle(stressSection(layer.feature)); 
    });
    updateAppearance();
    applyFilters();   
  }); 

  deselectall.addEventListener('click',() => {
    state.geolayer.eachLayer((layer) => {
      state.filters.sections.delete(layer.feature.properties.SEZ21); 
      layer.setStyle(basicSectionStyle(layer.feature)); 
    });
    updateAppearance();
    applyFilters(); 
  }); 

  state.geolayer.eachLayer((layer) => {
      state.filters.sections.add(layer.feature.properties.SEZ21); 
      layer.setStyle(stressSection(layer.feature)); 
  });
  updateAppearance();
  applyFilters(); 
}

async function setupMap() {
  const map = L.map('map',{   
    maxBounds: L.latLngBounds(L.latLng(-90,-180),L.latLng(90, 180)),
    maxBoundsViscosity: 1.0,  
    minZoom: 2
    })
  .setView([44.8015,10.3279],11.5);

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap contributors',
      noWrap: true,
      bounds: L.latLngBounds(L.latLng(-90,-180),L.latLng(90, 180)) }
  )
  .addTo(map);

  const sectionlookup = new Map();
  for (const [key,array] of state.sections) {
    sectionlookup.set(key,new Set(array));
  }

  const sectionsdata = await loadMapData(); 
  let geolayer = L.geoJson(sectionsdata,{
      style: basicSectionStyle,
      onEachFeature: (feature,layer) => {
        let section = feature.properties.SEZ21;

        let uninhab = true;
        for (const [key,set] of sectionlookup) {
          if (set.has(section)) {
            uninhab = false;
            break; 
          }
        }
        if (uninhab) {state.sections.get('Inabitate').add(section);}

        layer.bindTooltip(String(section),{
            sticky: true,       
            direction: "auto",  
            opacity: 0.9
        }); 

        layer.on('click',(e) => {
          L.DomEvent.stopPropagation(e)
          if (state.filters.sections.has(section)) {
            state.filters.sections.delete(section); 
            layer.setStyle(basicSectionStyle(layer.feature));
          }
          else {
            state.filters.sections.add(section); 
            layer.setStyle(stressSection(layer.feature));
          }
          applyFilters(); 
          updateAppearance();
        });

        layer.on({
          mouseout: () => {
            layer.closeTooltip();
          },
          click: () => {
            layer.closeTooltip();
          }
        });  
        
        map.on('zoomstart movestart',() => {
          layer.closeTooltip();
        });
      }
    }
  )
  .addTo(map); 

  map.on('click',() => {
    geolayer.eachLayer(lay => geolayer.resetStyle(lay));
    state.filters.sections.clear();  
    applyFilters();   
    updateAppearance();
  });  

  state.geolayer = geolayer;
}

function updateCountriesAppearance() {
  if (state.filters.countries.size == state.allcountries.size) {
    lighton(document.getElementById('countries-select-all'));
  }
  else {
    lightoff(document.getElementById('countries-select-all'));
  }

  if (state.filters.countries.size == 0) {
    lighton(document.getElementById('countries-deselect-all'));
  }
  else {
    lightoff(document.getElementById('countries-deselect-all'));
  }

  let exitaly = new Set(state.allcountries);
  exitaly.delete('Italy'); 
  if (exitaly.isSubsetOf(state.filters.countries)) {
    lighton(document.getElementById('ex-italy'));
  }
  else {
    lightoff(document.getElementById('ex-italy')); 
  }

  state.areas.forEach((countries,area) => {
    let set = new Set(countries);
    if (set.isSubsetOf(state.filters.countries)) {
      lighton(document.getElementById(area));
    }
    else {
      lightoff(document.getElementById(area)); 
    }
  });
}

function setupCountriesAll() {
  let selectall = document.getElementById('countries-select-all'); 
  selectall.addEventListener('click',() => {
    state.allcountries.forEach((c) => {
      if (!state.filters.countries.has(c)) {state.filters.countries.add(c);}
    });
    updateCountriesAppearance();   
    applyFilters(); 
  });
  let deselectall = document.getElementById('countries-deselect-all'); 
  deselectall.addEventListener('click',() => {
    state.filters.countries.clear();
    updateCountriesAppearance();   
    applyFilters(); 
  });
}

function setupExItaly() {
  const button = document.getElementById('ex-italy'); 
  button.addEventListener('click',() => {
    let set = new Set(state.allcountries);
    set.delete('Italy');
    if (set.isSubsetOf(state.filters.countries)) {
      set.forEach((c) => {
        if (state.filters.countries.has(c)) {state.filters.countries.delete(c);}
      });            
    }
    else {
      set.forEach((c) => {
        if (!state.filters.countries.has(c)) {state.filters.countries.add(c);}
      }); 
    }   
    updateCountriesAppearance();  
    applyFilters(); 
  });
}

function setupAreas() {
  const container = document.getElementById('areas-buttons'); 
  state.areas.forEach((countries,area) => {
    const button = document.createElement('button');
    button.id = area; 
    button.textContent = area;
    button.addEventListener('click',() => {
      let set = new Set(countries);
      if (set.isSubsetOf(state.filters.countries)) {
        set.forEach((c) => {
          state.filters.countries.delete(c); 
        }); 
      }
      else {
        set.forEach((c) => {
          state.filters.countries.add(c); 
        });
      }
      updateCountriesAppearance(); 
      applyFilters();   
    });
    container.appendChild(button); 
  });

  state.allcountries.forEach((c) => {
    if (!state.filters.countries.has(c)) {state.filters.countries.add(c);}
  });
  updateCountriesAppearance();   
  applyFilters();
}

// style
function basicSectionStyle(feature) {
    return {
        fillColor: 'grey', 
        weight: 1,           
        opacity: 2,
        color: state.colors.fg,       
        fillOpacity: 0.5
    };
}

function stressSection(feature) {
    return {
        weight: 2,                  
        opacity: 1,
        color: state.colors.hl,
        fillOpacity: 0.5
    };
}

/*====================================================================================================*/
function setupSub() {
  const abs = document.getElementById('absolute'); 
  const per = document.getElementById('percentage'); 

  if (state.filters.subvariable == "absolute") {
    lighton(abs);
    lightoff(per); 
  }
  else if (state.filters.subvariable == "percentage") {
    lighton(per);
    lightoff(abs); 
  }

  abs.addEventListener('click',() => {
    if (state.filters.subvariable == "percentage") {
      state.filters.subvariable = "absolute"; 
      lighton(abs);
      lightoff(per); 
      applyFilters();
    }
  });

  per.addEventListener('click',() => {
    if (state.filters.subvariable == "absolute") {
      state.filters.subvariable = "percentage"; 
      lighton(per);
      lightoff(abs);
      applyFilters();
    }
  });
}

/*====================================================================================================*/
// apply filters
function applyFilters() {
  const filtered = state.demo.filter(aq.escape(d => {
    return d.eta >= state.filters.ages.min &&
           d.eta <= state.filters.ages.max &&
           state.filters.countries.has(d.cittad) &&
           state.filters.sex.has(d.sesso);
  }));

  const counts = filtered.groupby('nsez').rollup({count: aq.op.count()}); 
  let dictionary; 
  if (state.filters.subvariable == "absolute") {
    dictionary = new Map(counts.array('nsez').map((c,i) => [c,counts.array('count')[i]]));
  }
  else if (state.filters.subvariable == "percentage") {
    dictionary = new Map(counts.array('nsez').map((c,i) => [c,counts.array('count')[i]/state.pops.get(c)]));
  }  

  let mini = new Map([...dictionary].filter(([section,val]) => state.filters.sections.has(section)));
  let min = Math.min(...mini.values());
  let max = Math.max(...mini.values());
  let range = max-min || 1; 
  
  const output = document.getElementById('selection-value'); 
  if (state.filters.subvariable == "absolute") {
    let sum = [...mini.values()].reduce((a,b) => a+b,0);     
    output.innerHTML = `Numero di residenti filtrati delle sezioni selezionate: <br><strong>${sum}</strong>`;
  }
  else if (state.filters.subvariable == "percentage") {
    let num = filtered.filter(aq.escape((d) => {
      return state.filters.sections.has(d.nsez);
    })).numRows();
    let den = 0;
    for (const s of state.filters.sections) {
      if (state.pops.get(s) != null) {den += state.pops.get(s);}       
    }
    let quo = num/den ?? 0; 
    output.innerHTML = `Percentuale rispetto ai residenti totali delle sezioni selezionate: <br><strong>${(quo*100).toFixed(2)}%</strong>`;
  }  

  state.geolayer.eachLayer((layer) => {
    let section = layer.feature.properties.SEZ21;
    let value = dictionary.get(section) ?? 0;
    if (state.filters.sections.has(section)) {       
      const ratio = (value-min)/range; 
      const lightness = 90-(ratio*60);   
      layer.setStyle({
        fillColor: `hsl(210,80%,${lightness}%)`,
        fillOpacity: 0.8,
      });      
    }   
    if (state.filters.subvariable == "absolute") {
      layer.setTooltipContent(`<strong>Identificativo sezione: ${section}</strong><br>Residenti: ${value}`);
    }
    else if (state.filters.subvariable == "percentage") {
      layer.setTooltipContent(`<strong>Identificativo sezione: ${section}</strong><br>Rispetto ai residenti totali della sezione: ${(value*100).toFixed(2)}%`);
    }    
  });
}

/*====================================================================================================*/
// main
async function main() {
  await loadAreas();
  await loadCenssec();
  await loadDemo();

  // map
  await setupMap();

  // tot pop per section
  calculateSectionsPop(); 

  // quartieri slicer
  setupLeftCentral();

  // age slider
  setupAgeSlider();

  // sex buttons
  setupSex(); 

  // areas buttons
  setupCountriesAll();
  setupExItaly();
  setupAreas();

  // subvariables
  setupSub(); 
}

main()