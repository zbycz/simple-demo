/*jslint browser: true*/
/*global Tangram, gui */

(function () {
    'use strict';

    var locations = {
        'London': [51.508, -0.105, 15],
        'New York': [40.70531887544228, -74.00976419448853, 15],
        'Seattle': [47.609722, -122.333056, 15]
    };

    var map_start_location = locations['New York'];

    /*** URL parsing ***/

    // leaflet-style URL hash pattern:
    // #[zoom],[lat],[lng]
    var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');

    if (url_hash.length == 3) {
        map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        // convert from strings
        map_start_location = map_start_location.map(Number);
    }

    /*** Map ***/

    var map = L.map('map',
        {'keyboardZoomOffset': .05}
    );


    var layer = Tangram.leafletLayer({
        scene: 'styles.yaml',
        attribution: 'Map data &copy; OpenStreetMap contributors | <a href="https://github.com/tangrams/tangram" target="_blank">Source Code</a>'
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    map.setView(map_start_location.slice(0, 2), map_start_location[2]);

    var hash = new L.Hash(map);
    


    // Feature selection
    function initFeatureSelection () {
        // Selection info shown on hover
        var selection_info = document.createElement('div');
        selection_info.setAttribute('class', 'label');
        selection_info.style.display = 'block';

        // Show selected feature on hover
        scene.container.addEventListener('mousemove', function (event) {
            var pixel = { x: event.clientX, y: event.clientY };
            scene.getFeatureAt(pixel).then(function(selection) {
                var feature = selection.feature;

                if (feature != null) {

                    var label = '';
                    if (feature.properties.name != null) {
                        label = feature.properties.name;
                    }

                    if (label != '') {
                        selection_info.style.left = (pixel.x + 5) + 'px';
                        selection_info.style.top = (pixel.y + 15) + 'px';
                        selection_info.innerHTML = '<span class="labelInner">' + label + '</span>';
                        scene.container.appendChild(selection_info);
                    }
                    else if (selection_info.parentNode != null) {
                        selection_info.parentNode.removeChild(selection_info);
                    }
                }
                else if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            });

            // Don't show labels while panning
            if (scene.panning == true) {
                if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            }
        });
    }


    // GUI options for rendering style/effects
    var style_options = {
        
        setup: function (style) {
            // Restore initial state
            var layer_styles = scene.config.layers;
            for (var l in layer_styles) {
                if (this.initial.layers[l]) {
                    layer_styles[l].style = Object.assign({}, this.initial.layers[l].style);
                }
            };

            if (this.initial.camera) {
                scene.setActiveCamera(this.initial.camera);
            }
            gui.camera = scene.getActiveCamera();

            // Style-specific settings
            if (style != '') {
                if (this.settings[style] != null) {
                    var settings = this.settings[style] || {};

                    // Change projection if specified
                    if (settings.camera) {
                        scene.setActiveCamera(settings.camera);
                    }
                    else if (this.initial.camera) {
                        scene.setActiveCamera(this.initial.camera);
                    }
                    gui.camera = this.initial.camera = scene.getActiveCamera();

                    // Style-specific setup function
                    if (settings.setup) {
                        settings.uniforms = function() { return settings.style.shaders.uniforms; };
                        settings.style = scene.styles[style];
                        settings.state = {}; // dat.gui needs a single object to old state

                        this.folder = style[0].toUpperCase() + style.slice(1); // capitalize first letter
                        settings.folder = gui.addFolder(this.folder);
                        settings.folder.open();

                        settings.setup(style);

                    }
                }
            }

            // Recompile/rebuild
            // scene.updateConfig();
            scene.rebuildGeometry();
            // updateURL();

            // Force-update dat.gui
            for (var i in gui.__controllers) {
                gui.__controllers[i].updateDisplay();
            }
        },
        settings: {
            'water': {
                setup: function (style) {
                    scene.config.layers.water.style.name = style;
                }
            },
            'elevator': {
                setup: function (style) {
                    scene.config.layers.buildings.style.name = style;
                }
            },
            'colorhalftone': {
                setup: function (style) {
                    scene.config.layers.buildings.style.name = style;
                    scene.config.layers.water.style.name = style;
                    scene.config.layers.landuse.style.name = style;
                    scene.config.layers.earth.style.name = style;

                    // scene.config.layers.pois.style.visible = false;
                }
            },
            'windows': {
                camera: 'isometric', // force isometric
                setup: function (style) {
                    scene.config.layers.buildings.style.name = style;
                    // scene.config.layers.pois.style.visible = false;
                }
            },
        },
        initial: { // initial state to restore to on style switch
            layers: {}
        },



    };

    // Create dat GUI
    var gui = new dat.GUI({ autoPlace: true });
    function addGUI () {
        gui.domElement.parentNode.style.zIndex = 5;
        window.gui = gui;
    }

    // Styles
    var style_controls = {
        "Default" : function() { console.log('explode'); }
        
    }
    var controls 
    gui.add(style_controls, 'Default').
        onChange(function() {console.log('click');});


    // Lighting
    var light_gui = gui.addFolder('Light');
    var light_controls = {
        "x position": .3,
        "y position": .5,
        "diffuse": 1,
        "ambient": .5
    };
    light_gui.
        add(light_controls, "x position", -1, 1).
        onChange(function(value) {
            scene.lights.key.direction[0] = -value;
        });
    light_gui.
        add(light_controls, "y position", -1, 1).
        onChange(function(value) {
            scene.lights.key.direction[1] = -value;
       });
    light_gui.
        add(light_controls, "diffuse", 0, 2).
        onChange(function(value) {
            scene.lights.key.diffuse = [value, value, value, 0];
        });
    light_gui.
        add(light_controls, "ambient", 0, 1).
        onChange(function(value) {
            scene.lights.key.ambient = [value, value, value, 1];
        });
    light_gui.open();


    // Resize map to window
    function resizeMap() {
        document.getElementById('map').style.width = window.innerWidth + 'px';
        document.getElementById('map').style.height = window.innerHeight + 'px';
        map.invalidateSize(false);
    }

    window.addEventListener('resize', resizeMap);
    resizeMap();

    window.addEventListener('load', function () {
        // Scene initialized
        layer.on('init', function() {
            addGUI();

            // if (url_style) {
            //     style_options.setup(url_style);
            // }
            // updateURL();

            initFeatureSelection();
        }); 
        layer.addTo(map);
    });


}());
