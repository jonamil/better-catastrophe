<template>
  <main>
    <div
      ref="container"
      class="flowchart"
      @mousedown="hideChapterListAndIntroPanel()"
    >
      <InlineSvg
        :src="flowchartAsset"
        :class="{ ready: flowchartElement }"
        @loaded="flowchartReady($event)"
      />
    </div>
    <audio
      ref="media"
      @loadedmetadata="flowchartStore.playbackDuration = $event.target.duration"
      @timeupdate="flowchartStore.playbackPosition = $event.target.currentTime"
      @stalled="flowchartStore.mediaBuffering = true"
      @loadeddata="flowchartStore.mediaBuffering = false"
      @playing="flowchartStore.mediaBuffering = false"
      @ended="stopPlayback(true)"
    >
      <source src="@/data/narration.m4a" type="audio/mp4" />
    </audio>
    <IntroPanel
      :introPanelVisible="introPanelVisible"
      :formUrl="formUrl"
      @togglePlayback="togglePlayback()"
      @toggleIntroPanel="toggleIntroPanel()"
    />
    <PlaybackControls
      :chapterListVisible="chapterListVisible"
      :introPanelVisible="introPanelVisible"
      @stopExplorationDuringPlayback="stopExplorationDuringPlayback()"
      @togglePlayback="togglePlayback()"
      @toggleChapterList="toggleChapterList()"
      @jumpNarrationToChapter="jumpNarrationToChapter($event)"
      @jumpNarrationToNode="jumpNarrationToNode($event)"
    />
    <FeedbackPrompt
      :formUrl="formUrl"
    />
  </main>
</template>

<script>
import { mapStores, mapActions } from 'pinia';
import { scaleLinear, easeExpOut } from 'd3';

import IntroPanel from '@/components/IntroPanel.vue';
import PlaybackControls from '@/components/PlaybackControls.vue';
import FeedbackPrompt from '@/components/FeedbackPrompt.vue';
import InlineSvg from 'vue-inline-svg';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';

import flowchartAsset from '@/assets/flowchart.svg';

export default {
  name: 'App',

  components: {
    IntroPanel,
    PlaybackControls,
    FeedbackPrompt,
    InlineSvg
  },

  data() {
    return {
      // unique session ID
      sessionId: undefined,

      // imported flowchart asset and container/svg elements
      flowchartAsset,
      flowchartContainer: undefined,
      flowchartElement: undefined,

      // state of control UI
      chapterListVisible: false,
      introPanelVisible: true,

      // whether narration node update is the first after resumption from local storage
      firstNarrationNodeUpdateAfterResumption: false,

      // count of how many times teased nodes have been attempted to be clicked
      teasedClickAttempts: 0,

      // window dimensions
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      shortestWindowSideLength: Math.min(window.innerWidth, window.innerHeight),

      // flowchart dimensions
      flowchartWidth: 0,
      flowchartHeight: 0,

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

      // return to playback timeout reference and auto-return delay
      returnToPlaybackTimeout: undefined,
      returnToPlaybackDelay: 8000,
      
      // fixed pixel values
      introPanelWidth: 416,
      fullWidthIntroPanelThreshold: 600,
      horizontalCenterOffset: 24,
      
      // logging and feedback form URLs
      loggingEnabled: true,
      loggingUrl: './log.php',
      formUrl: 'https://tally.so/r/wvr1AD',

      // wakeLock support and reference
      wakeLockSupported: false,
      wakeLock: null
    }
  },

  computed: {
    // properties from FlowchartStore
    ...mapStores(useFlowchartStore),
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
    // actions from FlowchartStore
    ...mapActions(useFlowchartStore, [
      'saveToLocalStorage',
      'resumeFromLocalStorage'
    ]),

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
            this.startExplorationDuringPlayback();
          }

          this.hideChapterListAndIntroPanel();
        });
      });

      // panning/scrolling of flowchart via click-and-drag
      this.flowchartContainer.addEventListener('mousedown', event => {
        // only start panning if drag was not initiated above visible node
        if (!event.target.closest('g[id^=n].teased, g[id^=n].revealed')) {
          if (this.flowchartStore.playbackActive) {
            this.startExplorationDuringPlayback();
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

      this.collectFlowchartNodes();
    },

    // populate flowchartStore’s flowchartNodes object with nodes from svg source
    collectFlowchartNodes() {
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
      this.addMouseListeners();
      this.setCurrentNodeId(this.flowchartStore.currentNodeId);
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
    addMouseListeners() {
      const vueInstance = this;

      Object.entries(this.flowchartStore.flowchartNodes).forEach(([nodeId, node]) => {
        node.element.addEventListener('click', function() {
          if (this.classList.contains('revealed')) {
            const differentFromCurrentNode = nodeId !== vueInstance.currentNodeId;

            // stop exploration during playback; if clicked node is different from current node,
            // omit movement (since this will be taken care of by jumpNarrationToNode)
            if (vueInstance.playbackActive && vueInstance.exploringDuringPlayback) {
              vueInstance.stopExplorationDuringPlayback(differentFromCurrentNode);
            }

            // if event is triggered during playback (and does not originate from the node already active),
            // jump narration position to that node; otherwise set node ID without affecting narration
            if (vueInstance.playbackActive && differentFromCurrentNode) {
              vueInstance.jumpNarrationToNode(nodeId);
            } else {
              vueInstance.setCurrentNodeId(nodeId);
            }
          } else if (this.classList.contains('teased')) {
            // if teased node is clicked, trigger the pulse animation for all incoming nodes
            node.incoming.forEach(incomingNode => {
              const nodeElement = incomingNode.node.element;

              if (nodeElement.classList.contains('revealed')) {
                nodeElement.classList.remove('pulse');
                void nodeElement.getBBox(); // trigger reflow
                nodeElement.classList.add('pulse');
              }
            });

            vueInstance.teasedClickAttempts++;
            if (vueInstance.teasedClickAttempts === 3) {
              alert('In order to reveal this item of the flowchart, please select any item pointing here first.');
            }
          }

          vueInstance.logEvent('input_clickNode');
        });
      });
    },

    // scroll the flowchart to center on an item
    moveToNode(item, forceMovement = false) {
      const itemPosition = item.element.getBBox();
      const destinationCoords = {
        x: (itemPosition.x + itemPosition.width / 2) * this.zoomScale - (
          this.introPanelVisible && this.windowWidth > this.fullWidthIntroPanelThreshold
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

      this.updateFlowchartAppearance();
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

    // update classes/appearance of svg elements
    updateFlowchartAppearance() {
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

    // jump playback position to chapter
    jumpNarrationToChapter(index) {
      this.setPlaybackPosition(this.flowchartStore.narrationChapters[index].timestamp);

      // if node of selected chapter is the same as the current narration node, this will not trigger
      // currentNarrationNodeId watcher -> therefore start playback manually
      if (this.flowchartStore.narrationChapters[index].id === this.flowchartStore.currentNarrationNodeId) {
        this.startPlayback();
      }

      this.logEvent('call_jumpNarrationToChapter');
    },

    // jump playback position to node (either current node or node clicked during playback)
    jumpNarrationToNode(nodeId) {
      const nodeOccurrencesInNarration = this.flowchartStore.narrationTimestamps.filter(event => event[0] === nodeId);

      if (nodeOccurrencesInNarration.length !== 0) {
        // if playback is active, jump to the next occurrence after the current playback position or the final one if none exists
        if (this.flowchartStore.playbackActive) {
          const nextNodeOccurrenceAfterPlaybackPosition = nodeOccurrencesInNarration.find(event => event[1] >= this.flowchartStore.playbackPosition);

          if (nextNodeOccurrenceAfterPlaybackPosition) {
            this.setPlaybackPosition(nextNodeOccurrenceAfterPlaybackPosition[1]);
          } else {
            const lastNodeOccurrence = nodeOccurrencesInNarration[nodeOccurrencesInNarration.length - 1];
            this.setPlaybackPosition(lastNodeOccurrence[1]);
          }
        // if playback is paused, jump to the first unlistened occurrence in narration sequence or the final one if none exists
        } else {
          let furthestNodeOccurrence = ['', 0];

          const noUnlistenedOccurrences = nodeOccurrencesInNarration.every(event => {
            if (this.flowchartStore.listenedTimestampIndexes.indexOf(this.flowchartStore.narrationTimestamps.indexOf(event)) === -1) {
              this.setPlaybackPosition(event[1]);
              return false;
            } else {
              furthestNodeOccurrence = event;
              return true;
            }
          });

          if (noUnlistenedOccurrences) {
            this.setPlaybackPosition(furthestNodeOccurrence[1]);
          }
        }
      } else {
        // if destination node does not occur within narration (happens when jump is triggered through node’s
        // click event while playback is active), stop playback and update the current node ID instead
        this.stopPlayback();
        this.setCurrentNodeId(nodeId);
      }

      this.logEvent('call_jumpNarrationToNode');
    },

    // update the current node ID
    setCurrentNodeId(nodeId) {
      this.flowchartStore.currentNodeId = nodeId;

      // move to the updated (now current) node ID, unless exploration
      // during playback is active, in which case only refresh appearance
      if (!this.flowchartStore.exploringDuringPlayback) {
        this.moveToNode(this.flowchartStore.currentNode);
      } else {
        this.updateFlowchartAppearance();
      }
      
      this.toggleChapterList(true);
      this.saveToLocalStorage();
    },

    // update current playback position and set currentTime of media to that position
    // (timeupdate event of media will keep updating playback position once ready/buffered)
    setPlaybackPosition(playbackPosition) {
      this.flowchartStore.playbackPosition = playbackPosition;
      this.$refs.media.currentTime = playbackPosition;
    },

    // start playback
    startPlayback(nodeIdAlreadySet = false) {
      this.hideChapterListAndIntroPanel();

      if (!nodeIdAlreadySet) {
        this.setCurrentNodeId(this.flowchartStore.currentNarrationNodeId);
      }

      // mark first chapter as listened if playback was started right from the start
      if (this.flowchartStore.listenedChapterIndexes.length === 0) {
        this.markChapterAsListened(this.flowchartStore.currentNarrationChapterIndex);
      }

      this.$refs.media.play();
      this.flowchartStore.playbackActive = true;
      this.requestWakeLock();
    },

    // stop playback
    stopPlayback(openChapterList = false) {
      this.$refs.media.pause();
      this.flowchartStore.playbackActive = false;
      this.stopExplorationDuringPlayback();
      this.releaseWakeLock();
      
      if (openChapterList) {
        this.toggleChapterList();
      }
    },

    // toggle playback
    togglePlayback() {
      this.flowchartStore.playbackActive ? this.stopPlayback() : this.startPlayback();
    },

    // start exploration during playback and set timeout to return to playback location automatically
    startExplorationDuringPlayback() {
      this.flowchartStore.exploringDuringPlayback = true;
      clearTimeout(this.returnToPlaybackTimeout);

      this.returnToPlaybackTimeout = setTimeout(this.stopExplorationDuringPlayback, this.returnToPlaybackDelay);

      this.logEvent('call_startExplorationDuringPlayback');
    },

    // stop exploration during playback
    stopExplorationDuringPlayback(omitMovement = false) {
      this.flowchartStore.exploringDuringPlayback = false;
      clearTimeout(this.returnToPlaybackTimeout);
      
      if (this.flowchartStore.playbackActive && !omitMovement) {
        this.moveToNode(this.flowchartStore.currentNode, true);
      }

      this.logEvent('call_stopExplorationDuringPlayback');
    },

    // toggle visibility of chapter list
    toggleChapterList(forceClose = false) {
      if (forceClose || this.chapterListVisible) {
        this.chapterListVisible = false;
      } else {
        this.chapterListVisible = true;
        this.toggleIntroPanel(true);
      }
    },

    // toggle visibility of intro panel
    toggleIntroPanel(forceClose = false) {
      if (forceClose || this.introPanelVisible) {
        this.introPanelVisible = false;
      } else {
        this.introPanelVisible = true;
        this.stopPlayback();
        this.toggleChapterList(true);
      }
    },

    // hide both chapter list and intro panel
    hideChapterListAndIntroPanel() {
      this.toggleChapterList(true);
      this.toggleIntroPanel(true);
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
    },

    // request and release wakeLock if supported
    async requestWakeLock() {
      if (this.wakeLockSupported) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
        } catch {
          // nevermind
        }
      }
    },
    async releaseWakeLock() {
      if (this.wakeLockSupported && this.wakeLock) {
        this.wakeLock.release().then(() => {
          this.wakeLock = null;
        })
      }
    },

    // log an event via a post request
    logEvent(eventType, additionalData = {}) {
      if (!this.loggingEnabled) {
        return;
      }

      const currentState = {
        nodeId: this.flowchartStore.currentNodeId,
        narrationNodeIndex: this.flowchartStore.currentNarrationNodeIndex,
        narrationChapterIndex: this.flowchartStore.currentNarrationChapterIndex,
        playbackActive: +this.flowchartStore.playbackActive,
        playbackPosition: this.flowchartStore.playbackPosition,
        chapterListVisible: +this.chapterListVisible,
        introPanelVisible: +this.introPanelVisible,
        exploringDuringPlayback: +this.flowchartStore.exploringDuringPlayback
      };

      fetch(this.loggingUrl, {
        method: 'post',
        body: JSON.stringify({
          eventType,
          session: this.sessionId,
          timestamp: Math.round(performance.now()),
          ...currentState,
          ...additionalData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        console.log(error);
      });
    }
  },

  watch: {
    // update current node ID upon change of narration node ID (which changes based on playback position)
    'flowchartStore.currentNarrationNodeId'() {
      // suppress updating current node ID and starting playback if state was resumed from storage and this is
      // the first narration node update (triggered by the playbackPosition being returned to the previous value)
      if (this.flowchartStore.resumedFromLocalStorage && !this.firstNarrationNodeUpdateAfterResumption) {
        this.firstNarrationNodeUpdateAfterResumption = true;
        return;
      }

      this.setCurrentNodeId(this.flowchartStore.currentNarrationNodeId);

      // start playback if not active already (happens when jumpNarrationToNode triggered)
      if (!this.flowchartStore.playbackActive) {
        this.startPlayback(true);
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

    // log certain properties changing
    'flowchartStore.currentNodeId'() {
      this.logEvent('update_nodeId');
    },
    'flowchartStore.playbackActive'() {
      this.logEvent('update_playbackActive');
    },
    chapterListVisible() {
      this.logEvent('update_chapterListVisible');
    },
    introPanelVisible() {
      this.logEvent('update_introPanelVisible');
    }
  },

  created() {
    // generate unique session ID for logging
    this.sessionId = new Date().getTime() + '_' + Math.random().toString(16).slice(2);

    // append session ID to form URL
    this.formUrl = this.formUrl + '?id=' + this.sessionId;

    // disable logging if URL parameter is found
    if (window.location.search === '?nolog') {
      this.loggingEnabled = false;
    }

    // d3 scaleLinear method to map window dimensions to min/max scale thresholds
    this.scaleFromWindowSideLength = scaleLinear(this.scaleParameters.domain, this.scaleParameters.range).clamp(true);
    
    // set wakeLockSupported if supported
    if ('wakeLock' in navigator) {
      this.wakeLockSupported = true;
    }

    // attempt to get state from previous session
    this.resumeFromLocalStorage();
  },

  mounted() {
    // if resumed from storage, set currentTime of media to playbackPosition from storage
    if (this.flowchartStore.resumedFromLocalStorage) {
      this.setPlaybackPosition(this.flowchartStore.playbackPosition);
    }

    // make spacebar trigger togglePlayback
    document.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Space') {
        event.preventDefault();
        
        this.togglePlayback();
        this.logEvent('input_spacebar');
      } else if (event.key === 'Enter' && this.flowchartStore.jumpActionAvailable) {
        event.preventDefault();

        this.jumpNarrationToNode(this.flowchartStore.currentNodeId);
        this.logEvent('input_enter');
      }
    });

    // log click events alongside the event targets’ DOM paths
    document.addEventListener('click', event => {
      const path = event.path || event.composedPath();
      
      const selectors = path.map(element => {
        element.classString = '';

        if (element.classList) {
          element.classList.forEach(className => {
            element.classString += '.' + className;
          });
        }

        return element.localName + (element.id ? '#' + element.id : '') + (element.classString ? element.classString : '');
      });

      this.logEvent('input_click', { eventTarget: selectors.toString() });
    });

    document.addEventListener('touchstart', () => {}, true);
  }
}
</script>

<style lang="scss">
@import '@/assets/normalize.css';
@import '@/assets/fonts.css';
@import '@/assets/variables.css';

body {
  background: var(--background-color);
}

#app {
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  font-size: 15px;
  text-rendering: optimizeLegibility;
  color: #fff;
  -webkit-tap-highlight-color: rgba(0,0,0,0);
}

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
    // cursor: default;
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

*:focus {
  outline: none;
}

*:focus-visible {
  box-shadow: 0 0 0 2px var(--background-color), 0 0 0 4px var(--focus-color) !important;
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