<template>
  <div ref="container" class="flowchart">
    <InlineSvg
      :src="flowchartAsset"
      :class="{ ready: flowchartElement }"
      @loaded="flowchartReady($event)"
    />
  </div>
</template>

<script>
import { mapStores } from 'pinia';
import { scaleLinear, easeExpOut } from 'd3';

import InlineSvg from 'vue-inline-svg';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';
import { useViewStore } from '@/stores/ViewStore.js';

import flowchartAsset from '@/assets/flowchart.svg';

export default {
  name: 'TheFlowchart',

  components: {
    InlineSvg
  },

  emits: [
    'setCurrentNodeId',
    'jumpNarrationToNode',
    'startPlayback',
    'startExplorationDuringPlayback',
    'stopExplorationDuringPlayback',
    'hideChapterListAndIntroPanel'
  ],

  data() {
    return {
      // imported flowchart asset and container/svg elements
      flowchartAsset,
      flowchartContainer: undefined,
      flowchartElement: undefined,

      // flowchart dimensions
      flowchartWidth: 0,
      flowchartHeight: 0,

      // window dimensions
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      shortestWindowSideLength: Math.min(window.innerWidth, window.innerHeight),

      // flowchart scaling parameters
      scaleParameters: {
        domain: [300, 600],
        range: [0.85, 1],
        minReductionFactor: 0.75
      },
      scaleFromWindowSideLength: undefined,

      // coordinates stored during panning/dragging
      panCoordinates: undefined,

      // parameters for movement/transitions to nodes
      transitionParameters: {
        screenSizeFactor: 0.15,
        maxTravelThreshold: 256,
        distanceFactor: 1.5,
        minDuration: 500,
        maxDuration: 1000
      },

      // count of how many times teased nodes have been attempted to be clicked
      teasedClickAttempts: 0,
      
      // fixed pixel values
      introPanelWidth: 416,
      fullWidthIntroPanelThreshold: 600,
      horizontalCenterOffset: 24,
    }
  },

  computed: {
    ...mapStores(
      useFlowchartStore,
      useViewStore
    ),
    // calculates scale factor for flowchart element extent based on window dimensions
    zoomScale() {
      return this.scaleFromWindowSideLength(this.shortestWindowSideLength);
    },
    // calculates travel distance threshold below which no movement happens when a new node becomes active during narration
    travelThreshold() {
      return Math.min(
        this.shortestWindowSideLength * this.transitionParameters.screenSizeFactor,
        this.transitionParameters.maxTravelThreshold
      );
    }
  },

  methods: {
    // flowchart inline SVG loaded
    flowchartReady(element) {
      this.flowchartContainer = this.$refs.container;
      this.flowchartElement = element;

      // store initial dimensions of flowchart svg elements for scaling
      const boundingClientRect = element.getBoundingClientRect();
      this.flowchartWidth = boundingClientRect.width;
      this.flowchartHeight = boundingClientRect.height;

      // set window dimension properties and scaled flowchart width and height upon window resize
      window.addEventListener('resize', () => {
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.shortestWindowSideLength = Math.min(window.innerWidth, window.innerHeight);

        this.flowchartElement.setAttribute('width', this.flowchartWidth * this.zoomScale);
        this.flowchartElement.setAttribute('height', this.flowchartHeight * this.zoomScale);
      });

      // dispatch resize event to initially set scaled flowchart width and height
      window.dispatchEvent(new Event('resize'));

      // stop playback and hide chapter list / intro panel upon user-initiated scrolling
      ['wheel', 'touchmove'].forEach(eventName => {
        this.flowchartContainer.addEventListener(eventName, () => {
          if (this.flowchartStore.playbackActive) {
            this.$emit('startExplorationDuringPlayback');
          }

          this.$emit('hideChapterListAndIntroPanel');
        });
      });

      // panning/scrolling of flowchart via click-and-drag
      this.flowchartContainer.addEventListener('mousedown', event => {
        // only start panning if drag was not initiated above visible node
        if (!event.target.closest('g[id^=n].teased, g[id^=n].revealed')) {
          if (this.flowchartStore.playbackActive) {
            this.$emit('startExplorationDuringPlayback');
          }

          this.flowchartContainer.classList.add('panning');

          this.panCoordinates = {
            xScroll: this.flowchartContainer.scrollLeft,
            yScroll: this.flowchartContainer.scrollTop,
            xPointer: event.clientX,
            yPointer: event.clientY
          };

          this.flowchartContainer.addEventListener('mousemove', mousemoveHandler);
          this.flowchartContainer.addEventListener('mouseup', mouseupHandler);
        }

        event.preventDefault();
      });

      // scroll flowchart container based on delta between start of drag and current pointer position
      const mousemoveHandler = event => {
        const xDelta = event.clientX - this.panCoordinates.xPointer;
        const yDelta = event.clientY - this.panCoordinates.yPointer;

        this.flowchartContainer.scrollTo({
          left: this.panCoordinates.xScroll - xDelta,
          top: this.panCoordinates.yScroll - yDelta,
          behavior: 'instant'
        });
      };

      // end of panning/dragging
      const mouseupHandler = () => {
        this.panCoordinates = undefined;
        this.flowchartContainer.classList.remove('panning');
        this.flowchartContainer.removeEventListener('mousemove', mousemoveHandler);
        this.flowchartContainer.removeEventListener('mouseup', mouseupHandler);
      };

      this.collectNodes();
    },

    // populate flowchartStore’s flowchartNodes object with nodes from svg source
    collectNodes() {
      const nodes = this.flowchartElement.querySelectorAll('g[id^=n]');

      nodes.forEach(nodeElement => {
        const nodeProperties = nodeElement.id.split('_');
        const nodeId = nodeProperties[0];
        
        this.flowchartStore.flowchartNodes[nodeId] = {
          element: nodeElement,
          type: nodeProperties[1],
          label: this.truncatedLabelFromTextContent(nodeElement.textContent),
          outgoing: [],
          incoming: []
        };
      });

      const edges = this.flowchartElement.querySelectorAll('g[id^=e_]');

      edges.forEach(edgeElement => {
        const edgeProperties = edgeElement.id.split('_');
        const edgeFrom = 'n' + edgeProperties[1];
        const edgeTo = 'n' + edgeProperties[2];
        const bidirectionalEdge = edgeProperties.length > 3;

        this.flowchartStore.flowchartNodes[edgeFrom].outgoing.push({
          edge: edgeElement,
          node: this.flowchartStore.flowchartNodes[edgeTo]
        });
        this.flowchartStore.flowchartNodes[edgeTo].incoming.push({
          edge: edgeElement,
          node: this.flowchartStore.flowchartNodes[edgeFrom]
        });

        // if edge is bidirectional, additionally add the same edge in reverse to the destination/origin node
        if (bidirectionalEdge) {
          this.flowchartStore.flowchartNodes[edgeTo].outgoing.push({
            edge: edgeElement,
            node: this.flowchartStore.flowchartNodes[edgeFrom]
          });
          this.flowchartStore.flowchartNodes[edgeFrom].incoming.push({
            edge: edgeElement,
            node: this.flowchartStore.flowchartNodes[edgeTo]
          });
        }
      });

      this.collectNarrationChapters();
      this.addNodeInteractivity();
      this.moveToNode(this.flowchartStore.currentNode);
    },

    // populate flowchartStore’s narrationChapters array with non-label nodes
    collectNarrationChapters() {
      const alreadyListedPrimaryChapters = [];

      this.flowchartStore.narrationTimestamps.forEach(event => {
        const eventId = event[0];
        const eventTimestamp = event[1];

        const node = this.flowchartStore.flowchartNodes[eventId];
        const firstItemOrNoDirectRepetition = this.flowchartStore.narrationChapters.length === 0 || this.flowchartStore.narrationChapters[this.flowchartStore.narrationChapters.length - 1].id !== eventId;
        
        if (node.type !== 'label' && firstItemOrNoDirectRepetition) {
          const chapterType = node.type === 'chapter' && alreadyListedPrimaryChapters.indexOf(eventId) === -1
            ? 'primary'
            : 'secondary';

          this.flowchartStore.narrationChapters.push({
            id: eventId,
            element: node.element,
            type: chapterType,
            label: node.label,
            timestamp: eventTimestamp,
          });

          alreadyListedPrimaryChapters.push(eventId);
        }
      });
    },

    // attach click listeners to node elements
    addNodeInteractivity() {
      const vueInstance = this;

      Object.entries(this.flowchartStore.flowchartNodes).forEach(([nodeId, node]) => {
        node.element.addEventListener('click', function() {
          if (this.classList.contains('revealed')) {
            // stop exploration during playback if active
            if (vueInstance.flowchartStore.playbackActive && vueInstance.flowchartStore.exploringDuringPlayback) {
              vueInstance.$emit('stopExplorationDuringPlayback');
            }

            // if clicked node is different from current node, either jump narration to that node (if playback is active)
            // or set node ID without affecting narration; otherwise re-center current node
            if (nodeId !== vueInstance.flowchartStore.currentNodeId) {
              if (vueInstance.flowchartStore.playbackActive) {
                vueInstance.$emit('jumpNarrationToNode', nodeId);
              } else {
                vueInstance.$emit('setCurrentNodeId', nodeId);
              }
            } else {
              vueInstance.moveToNode(vueInstance.flowchartStore.currentNode, true);
            }
          } else if (this.classList.contains('teased')) {
            // if teased node is clicked, trigger the pulse animation for all incoming nodes
            node.incoming.forEach(incomingObject => {
              const incomingNode = incomingObject.node.element;

              if (incomingNode.classList.contains('revealed')) {
                incomingNode.classList.remove('pulse');
                void incomingNode.getBBox(); // trigger reflow
                incomingNode.classList.add('pulse');
              }
            });

            // display hint alert upon third click attempt
            vueInstance.teasedClickAttempts++;
            if (vueInstance.teasedClickAttempts === 3) {
              alert('In order to reveal this item of the flowchart, please select any item pointing here first.');
            }
          }
        });
      });
    },

    // scroll the flowchart to center on an item
    moveToNode(item, forceMovement = false) {
      const itemPosition = item.element.getBBox();
      const destinationCoords = {
        x: (itemPosition.x + itemPosition.width / 2) * this.zoomScale - (
          this.viewStore.introPanelVisible && this.windowWidth > this.fullWidthIntroPanelThreshold
            ? this.introPanelWidth / 2 - this.horizontalCenterOffset
            : 0
        ),
        y: (itemPosition.y + itemPosition.height / 2) * this.zoomScale + this.windowHeight * 0.05
      };

      const currentCoords = {
        x: this.flowchartContainer.scrollLeft,
        y: this.flowchartContainer.scrollTop
      };

      const travelDistance = Math.sqrt(
        Math.pow(currentCoords.x - destinationCoords.x, 2) + Math.pow(currentCoords.y - destinationCoords.y, 2)
      );

      // omit movement if playback is active and distance from viewport center to destination node falls below threshold
      if (forceMovement || !this.flowchartStore.playbackActive || travelDistance > this.travelThreshold) {
        const duration = Math.min(
          Math.max(
            travelDistance * this.transitionParameters.distanceFactor,
            this.transitionParameters.minDuration
          ),
          this.transitionParameters.maxDuration
        );

        this.smoothScroll(destinationCoords.x, destinationCoords.y, duration);
      }

      this.updateAppearance();
    },

    // smooth scroll to coordinate using custom duration and easing
    smoothScroll(xEnd, yEnd, duration) {
      const time = Date.now();
      const xStart = this.flowchartContainer.scrollLeft;
      const yStart = this.flowchartContainer.scrollTop;

      const step = () => {
        const elapsed = Date.now() - time;
        const scrolling = elapsed < duration;
        const x = scrolling ? xStart + (xEnd - xStart) * easeExpOut(elapsed / duration) : xEnd;
        const y = scrolling ? yStart + (yEnd - yStart) * easeExpOut(elapsed / duration) : yEnd;

        if (scrolling) {
          requestAnimationFrame(step);
        }

        this.flowchartContainer.scrollTo({
          left: x,
          top: y,
          behavior: 'instant'
        });
      }

      step();
    },

    // update classes/appearance of svg elements
    updateAppearance() {
      this.flowchartElement.querySelectorAll('g').forEach(element => {
        element.classList.remove('current', 'next', 'revealed', 'teased');
      });

      this.flowchartStore.currentNode.element.classList.add('current');
      this.markItemAsRevealed(this.flowchartStore.currentNode.element);

      this.flowchartStore.currentNode.outgoing.forEach(item => {
        item.edge.classList.add('next');
        item.node.element.classList.add('next');
        this.markItemAsRevealed(item.edge);
        this.markItemAsRevealed(item.node.element);

        item.node.outgoing.forEach(subsequentItem => {
          this.markItemAsTeased(subsequentItem.edge);
          this.markItemAsTeased(subsequentItem.node.element);
        });
      });

      this.flowchartStore.revealedItems.forEach(id => {
        document.getElementById(id).classList.add('revealed');
      });

      this.flowchartStore.teasedItems.forEach(id => {
        document.getElementById(id).classList.add('teased');
      });
    },

    // add node element to revealedItems array
    markItemAsRevealed(node) {
      if (this.flowchartStore.revealedItems.indexOf(node.id) === -1) {
        this.flowchartStore.revealedItems.push(node.id);
      }
    },

    // add node element to teasedItems array
    markItemAsTeased(node) {
      if (this.flowchartStore.teasedItems.indexOf(node.id) === -1) {
        this.flowchartStore.teasedItems.push(node.id);
      }
    },

    // add timestamp/event index to listenedTimestampIndexes array
    markTimestampAsListened(index) {
      if (this.flowchartStore.listenedTimestampIndexes.indexOf(index) === -1) {
        this.flowchartStore.listenedTimestampIndexes.push(index);
      }
    },

    // add chapter index to listenedChapterIndexes array
    markChapterAsListened(index) {
      if (this.flowchartStore.listenedChapterIndexes.indexOf(index) === -1) {
        this.flowchartStore.listenedChapterIndexes.push(index);
      }
    },

    // create trimmed and truncated label from textContent of node element
    truncatedLabelFromTextContent(label) {
      label = label.replaceAll('\n', ' ').trim();

      if (label.length <= 32) {
        return label;
      } else {
        const words = label.substring(0, 32).split(' ');
        words.pop();
        return words.join(' ') + '…';
      }
    }
  },

  watch: {
    // when a new node ID is set, move to the updated (now current) node ID,
    // unless exploration during playback is active, in which case only refresh appearance
    'flowchartStore.currentNodeId'() {
      if (!this.flowchartStore.exploringDuringPlayback) {
        this.moveToNode(this.flowchartStore.currentNode);
      } else {
        this.updateAppearance();
      }
    },

    // update current node ID upon change of narration node ID (which changes based on playback position)
    'flowchartStore.currentNarrationNodeId'() {
      this.$emit('setCurrentNodeId', this.flowchartStore.currentNarrationNodeId);

      // start playback if not active already (happens when jumpNarrationToNode is triggered)
      if (!this.flowchartStore.playbackActive) {
        this.$emit('startPlayback', true);
      }
    },

    // when the narration index changes, mark that timestamp/event as listened
    'flowchartStore.currentNarrationNodeIndex'() {
      this.markTimestampAsListened(this.flowchartStore.currentNarrationNodeIndex);
    },

    // when the narration chapter index changes, mark that chapter as listened
    'flowchartStore.currentNarrationChapterIndex'() {
      this.markChapterAsListened(this.flowchartStore.currentNarrationChapterIndex);
    },

    // when playback is started, move to current node (if current node
    // does not change, no movement is otherwise initiated)
    'flowchartStore.playbackActive'() {
      if (this.flowchartStore.playbackActive) {
        this.moveToNode(this.flowchartStore.currentNode);
      }

      // mark first chapter as listened if playback was started right from the start
      if (this.flowchartStore.listenedChapterIndexes.length === 0) {
        this.markChapterAsListened(this.flowchartStore.currentNarrationChapterIndex);
      }
    },

    // move back to current node if exploration during playback ends
    'flowchartStore.exploringDuringPlayback'() {
      if (!this.flowchartStore.exploringDuringPlayback && this.flowchartStore.playbackActive) {
        this.moveToNode(this.flowchartStore.currentNode, true);
      }
    },
  },

  created() {
    // d3 scaleLinear method to map window dimensions to min/max scale thresholds
    this.scaleFromWindowSideLength = scaleLinear(this.scaleParameters.domain, this.scaleParameters.range).clamp(true);
  }
}
</script>

<style lang="scss">
@import '@/assets/variables.css';

.flowchart {
  position: absolute;
  overflow: auto;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 0;
    height: 0;
  }

  &.panning {
    cursor: grabbing;
  }

  svg {
    opacity: 0;
    visibility: hidden;
    margin: 50vh 50vw;
    transition: opacity 0.25s var(--transition-timing), visibility 0.25s var(--transition-timing);

    &.ready {
      opacity: 1;
      visibility: visible;
    }

    // nodes
    g[id^=n] {
      opacity: 0;

      &.pulse {
        animation: pulse 0.6s 1 forwards ease-in-out;
      }

      path, text, rect {
        transition: all 0.075s var(--transition-timing);
      }

      path {
        fill: var(--teased-color);
        stroke: transparent;
      }

      text {
        fill: transparent;
      }

      &[id$=label] {
        rect {
          fill: var(--teased-color);
          fill-opacity: 1;
        }
      }

      // all visible nodes (teased and revealed)
      &.teased, &.revealed {
        opacity: 1;
      }

      &.teased:not(.revealed) {
        cursor: not-allowed;
      }

      // revealed nodes (interactive and text visible)
      &.revealed {
        path {
          opacity: 0.35;
          fill: var(--background-color);
          stroke: #fff;
        }

        text {
          fill: rgba(255,255,255,0.75);
        }

        &[id$=chapter], &[id$=question] {
          path {
            fill: rgba(255,255,255,0.4);
          }
        }

        &[id$=definition] {
          path {
            fill: rgba(0,0,0,0.001);
          }

          path:first-of-type {
            stroke: transparent;
          }
        }

        &[id$=collection] {
          path:first-of-type {
            fill: rgba(0,0,0,0.001);
            stroke: transparent;
          }
        }

        &[id$=label] {
          rect {
            fill: transparent;
          }

          path {
            opacity: 1;
            stroke: #C9C9C9;
          }
        }

        &:hover {
          cursor: pointer;

          path {
            opacity: 0.5;
          }

          text {
            fill: #fff;
          }

          &[id$=label] {
            path {
              opacity: 1;
              stroke: #fff;
            }
          }
        }
      }

      // next nodes and currently selected node
      &.next, &.current {
        path {
          opacity: 0.85;
          stroke: rgb(var(--accent-color));
        }

        text {
          fill: rgb(var(--accent-color));
        }

        &[id$=chapter], &[id$=question] {
          path {
            fill: rgba(var(--accent-color), 0.25);
          }
        }

        &[id$=label] {
          path {
            opacity: 1;
            stroke: rgb(var(--accent-color));
          }
        }

        &:not(.current):hover {
          path {
            opacity: 0.85;
            stroke: rgb(var(--accent-color-hover));
          }

          text {
            fill: rgb(var(--accent-color-hover));
          }

          &[id$=chapter], &[id$=question] {
            path {
              fill: rgba(var(--accent-color-hover), 0.3);
            }
          }

          &[id$=definition], &[id$=collection] {
            path:first-of-type {
              stroke: transparent;
            }
          }

          &[id$=label] {
            path {
              opacity: 1;
              stroke: rgb(var(--accent-color-hover));
            }
          }
        }
      }

      // currently selected node
      &.current {
        &[id$=definition] {
          path:last-of-type {
            opacity: 0;
          }
        }

        &:not([id$=label]) {
          path {
            opacity: 1;
            fill: rgb(var(--accent-color));
          }

          text {
            fill: #fff;
          }
        }

        &[id$=label] {
          text {
            fill: #fff;
          }

          rect {
            fill: rgb(var(--accent-color));
          }

          path {
            stroke: #fff;
          }
        }
      }
    }

    // edges
    g[id^=e_] {
      opacity: 0;
      pointer-events: none;

      path, text {
        fill: var(--teased-color);
      }

      &.teased, &.revealed {
        opacity: 1;
      }

      &.revealed {
        path {
          fill: rgba(255,255,255,0.25);
        }

        text {
          fill: rgba(255,255,255,0.4);
        }
      }

      &.next {
        path {
          fill: rgba(var(--accent-color), 0.6);
        }

        text {
          fill: rgba(var(--accent-color), 0.75);
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 50%, 100% {
    opacity: 1;
  }

  25%, 75% {
    opacity: 0.35;
  }
}
</style>