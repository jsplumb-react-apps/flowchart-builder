import React, { useEffect, useRef, useState} from 'react';

import {
    SurfaceProvider,
    SurfaceComponent,
    MiniviewComponent,
    ShapeLibraryPaletteComponent,
    ControlsComponent,
    ExportControlsComponent
} from "@jsplumbtoolkit/browser-ui-react";

import { DEFAULT, EVENT_DBL_CLICK, EVENT_CLICK, EVENT_TAP,
    BlankEndpoint, OrthogonalConnector,
    BackgroundPlugin, LassoPlugin, DrawingToolsPlugin,
    EVENT_CANVAS_CLICK,
    ShapeLibraryImpl,
    FLOWCHART_SHAPES, BASIC_SHAPES,
    SelectionModes, newInstance,
    initializeOrthogonalConnectorEditors, LabelOverlay, consume
} from "@jsplumbtoolkit/browser-ui"

import Inspector from './InspectorComponent'
import NodeComponent from './NodeComponent'

import {
    DEFAULT_FILL,
    DEFAULT_STROKE,
    DEFAULT_TEXT_COLOR,
    CLASS_EDGE_LABEL,
    CLASS_FLOWCHART_EDGE,
    GRID_BACKGROUND_OPTIONS,
    GRID_SIZE,
    EDGE_TYPE_TARGET_ARROW, PROPERTY_COLOR, PROPERTY_LABEL, PROPERTY_LINE_STYLE
} from "./constants";

import edgeMappings from "./edge-mappings"

import './index.css'

//
// these anchor positions are used by the drag/drop of new edges, and also by the edge path editor
//
export const anchorPositions = [
    {x:0, y:0.5, ox:-1, oy:0, id:"left" },
    {x:1, y:0.5, ox:1, oy:0, id:"right" },
    {x:0.5, y:0, ox:0, oy:-1, id:"top" },
    {x:0.5, y:1, ox:0, oy:1, id:"bottom" }
]

export default function FlowchartComponent() {

    const initialized = useRef(false)
    const shapeLibrary = new ShapeLibraryImpl([FLOWCHART_SHAPES, BASIC_SHAPES])

    const surfaceComponent = useRef(null)
    const surface = useRef(null)

    /**
     * Generator for data for nodes dragged from palette.
     * @param el
     */
    const dataGenerator = (el) => {
        return {
            fill:DEFAULT_FILL,
            outline:DEFAULT_STROKE,
            textColor:DEFAULT_TEXT_COLOR
        }
    }

    //
    // We create a toolkit instance ourselves here, which we reference in other parts of the code.  We could instead have just
    // passed in `modelOptions` to our `SurfaceComponent`, but then we'd have to extract a reference to the Toolkit in our useEffect.
    const toolkit = useRef(newInstance({
        // set the Toolkit's selection mode to 'isolated', meaning it can select a set of edges, or a set of nodes, but it
        // cannot select a set of nodes and edges. In this demonstration we use an inspector that responds to events from the
        // toolkit's selection, so setting this to `isolated` helps us ensure we dont try to inspect edges and nodes at the same
        // time.
        selectionMode:SelectionModes.isolated,
        // This is the payload to set when a user begins to drag an edge - we return values for the
        // edge's label, color and line style. If you wanted to implement a mechanism whereby you have
        // some "current style" you could update this method to return some dynamically configured
        // values.
        beforeStartConnect:(node, edgeType) => {
            return {
                [PROPERTY_LABEL]:"",
                [PROPERTY_COLOR]:DEFAULT_STROKE,
                [PROPERTY_LINE_STYLE]:EDGE_TYPE_TARGET_ARROW
            }
        }
    }))

    initializeOrthogonalConnectorEditors()

    const view = {
        nodes: {
            [DEFAULT]: {
                jsx: (ctx) => {
                    return <NodeComponent ctx={ctx}/>
                },
                // node can support any number of connections.
                maxConnections: -1,
                events: {
                    [EVENT_TAP]: (params) => {
                        // if zero nodes currently selected, or the shift key wasnt pressed, make this node the only one in the selection.
                        if (toolkit.current.getSelection().getNodes().length < 1 || params.e.shiftKey !== true) {
                            toolkit.current.setSelection(params.obj)
                        } else {
                            // if multiple nodes already selected, or shift was pressed, add this node to the current selection.
                            toolkit.current.addToSelection(params.obj)
                        }
                    }
                }
            }
        },
        // There are two edge types defined - 'yes' and 'no', sharing a common
        // parent.
        edges: {
            [DEFAULT]: {
                deleteButton:true, // show a delete button
                connector: {
                    type: OrthogonalConnector.type,
                    options: {
                        stub:GRID_SIZE.w
                    }
                },
                cssClass:CLASS_FLOWCHART_EDGE,
                labelClass:CLASS_EDGE_LABEL,
                label:"{{label}}",
                outlineWidth:10,
                events: {
                    [EVENT_CLICK]: (params) => {
                        if (!params.e.defaultPrevented) {
                            toolkit.current.setSelection(params.edge)
                        }
                    }
                },
                overlays:[
                    {
                        type:LabelOverlay.type,
                        options:{
                            useHTMLElement:false,
                            cssClass:CLASS_EDGE_LABEL,
                            label:"{{label}}",
                            location:0.5
                        }
                    }
                ]
            }
        }
    }

    const renderParams = {
        grid:{
            size:GRID_SIZE
        },
        events: {
            [EVENT_CANVAS_CLICK]: (e) => {
                toolkit.current.clearSelection()
            }
        },
        propertyMappings:{
            edgeMappings:edgeMappings()
        },
        consumeRightClick: false,
        dragOptions: {
            filter: ".node-action, .node-action i"
        },
        plugins:[
            DrawingToolsPlugin.type,
            {
                type:LassoPlugin.type,
                options: {
                    lassoInvert:true,
                    lassoEdges:true
                }
            },
            {
                type:BackgroundPlugin.type,
                options:GRID_BACKGROUND_OPTIONS
            }
        ],
        // set the size of elements from the width/height values in their backing data
        useModelForSizes:true,
        // on load, zoom the dataset so its all visible
        zoomToFit:true,
        defaults:{
           edgesAvoidVertices:true
        },
        magnetize:{
            constant:true,
            trackback:true
        }
    }

    // set a couple of refs and load data on "mount"
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true

            surface.current = surfaceComponent.current.getSurface()

            ;(window.s) = surface.current

            // load an initial dataset (we load this directly in the SurfaceComponent but you can do it this way)
            toolkit.current.load({
                url:"/copyright.json",
                //onload:() => setTimeout(() => surface.current.repaintEverything(), 250)
            })
        }

    }, [])

    return  <div style={{width:"100%",height:"100%",display:"flex"}}>
                <div className="jtk-demo-canvas">
                    <SurfaceProvider>

                        <SurfaceComponent shapeLibrary={shapeLibrary}
                                          renderOptions={renderParams}
                                          toolkit={toolkit.current}
                                          viewOptions={view}
                                          ref={ surfaceComponent }
                                          purl="/copyright.json">

                            <ControlsComponent/>
                            <ExportControlsComponent/>
                            <MiniviewComponent/>
                        </SurfaceComponent>

                        <div className="jtk-demo-rhs">
                            <ShapeLibraryPaletteComponent className="node-palette" dataGenerator={dataGenerator} initialSet={FLOWCHART_SHAPES.id}/>
                            <Inspector edgeMappings={edgeMappings()}/>
                        </div>

                    </SurfaceProvider>
                </div>
        </div>
}
