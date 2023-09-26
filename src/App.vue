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
      @loadedmetadata="playbackDuration = $event.target.duration"
      @timeupdate="playbackPosition = $event.target.currentTime"
      @stalled="mediaBuffering = true"
      @loadeddata="mediaBuffering = false"
      @playing="mediaBuffering = false"
      @ended="stopPlayback(true)"
    >
      <source src="@/data/narration.m4a" type="audio/mp4" />
    </audio>
    <IntroPanel
      :introPanelVisible="introPanelVisible"
      :resetPromptVisible="resetPromptVisible"
      :formUrl="formUrl"
      @togglePlayback="togglePlayback()"
      @toggleIntroPanel="toggleIntroPanel()"
      @clearLocalStorageAndReload="clearLocalStorageAndReload()"
    />
    <PlaybackControls
      :narrationChapters="narrationChapters"
      :currentNodeId="currentNodeId"
      :currentNarrationNodeId="currentNarrationNodeId"
      :currentNarrationChapterIndex="currentNarrationChapterIndex"
      :currentNarrationChapter="currentNarrationChapter"
      :listenedChapterIndexes="listenedChapterIndexes"
      :revealedItems="revealedItems"
      :playbackActive="playbackActive"
      :playbackProgress="playbackProgress"
      :mediaBuffering="mediaBuffering"
      :exploringDuringPlayback="exploringDuringPlayback"
      :jumpActionVisible="jumpActionVisible"
      :jumpActionAvailable="jumpActionAvailable"
      :chapterListVisible="chapterListVisible"
      :introPanelVisible="introPanelVisible"
      @stopExplorationDuringPlayback="stopExplorationDuringPlayback()"
      @togglePlayback="togglePlayback()"
      @toggleChapterList="toggleChapterList()"
      @jumpNarrationToChapter="jumpNarrationToChapter($event)"
      @jumpNarrationToNode="jumpNarrationToNode($event)"
    />
    <FeedbackPrompt
      :visible="feedbackPromptVisible"
      :formUrl="formUrl"
    />
  </main>
</template>

<script>
import IntroPanel from '@/components/IntroPanel.vue';
import PlaybackControls from '@/components/PlaybackControls.vue';
import FeedbackPrompt from '@/components/FeedbackPrompt.vue';

import flowchartAsset from '@/assets/flowchart.svg';
import narrationTimestamps from '@/data/timestamps.json';

import InlineSvg from 'vue-inline-svg';
import { scaleLinear, easeExpOut } from 'd3';

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
      
      // related to flowchart nodes
      flowchartNodes: {},
      currentNodeId: 'n001',
      teasedItems: [],
      revealedItems: [],

      // related to flowchart narration/timestamps
      narrationTimestamps,
      listenedTimestampIndexes: [],
      narrationChapters: [],
      listenedChapterIndexes: [],

      // state of playback
      playbackDuration: 1,
      playbackPosition: 0,
      playbackActive: false,
      mediaBuffering: false,

      // state of exploration during playback
      exploringDuringPlayback: false,
      returnToPlaybackTimeout: undefined,
      returnToPlaybackDelay: 10000,

      // state of resumption from local storage
      resumedFromStorage: false,
      firstNarrationNodeUpdateAfterResumption: false,

      // state of control UI
      chapterListVisible: false,
      introPanelVisible: true,
      resetPromptVisible: false,
      resetPromptDelayAfterInteraction: 500,

      // count how many times teased nodes have been attempted to be clicked
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
      
      // fixed pixel values
      introPanelWidth: 416,
      fullWidthIntroPanelThreshold: 600,
      horizontalCenterOffset: 24,
      // verticalCenterOffset
      
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
    // playback progress as percentage (with minimum value for initial progress bar visibility)
    playbackProgress() {
      if (this.playbackPosition !== 0) {
        return Math.max(Math.round(this.playbackPosition / this.playbackDuration * 1000) / 1000, 0.015);
      } else {
        return 0;
      }
    },
    // current node object
    currentNode() {
      return this.flowchartNodes[this.currentNodeId];
    },
    // current index in narrationTimestamps based on media playback position
    currentNarrationNodeIndex() {
      const nextNarrationNodeIndex = this.narrationTimestamps.findIndex(event => event[1] > this.playbackPosition);

      if (nextNarrationNodeIndex === -1) {
        // no more narration events after playback position, thus return last index
        return Math.max(this.narrationTimestamps.length - 1, 0);
      } else {
        // return the current index (subsequent index minus one)
        return Math.max(nextNarrationNodeIndex - 1, 0);
      }
    },
    // current narration node ID
    currentNarrationNodeId() {
      return this.narrationTimestamps[this.currentNarrationNodeIndex][0];
    },
    // current narration node object
    currentNarrationNode() {
      return this.flowchartNodes[this.currentNarrationNodeId];
    },
    // current chapter index based on playback position
    currentNarrationChapterIndex() {
      const nextNarrationChapterIndex = this.narrationChapters.findIndex(chapter => chapter.timestamp > this.playbackPosition);

      if (nextNarrationChapterIndex === -1) {
        return Math.max(this.narrationChapters.length - 1, 0);
      } else {
        return Math.max(nextNarrationChapterIndex - 1, 0);
      }
    },
    // current chapter object
    currentNarrationChapter() {
      return this.narrationChapters[this.currentNarrationChapterIndex];
    },
    // determines whether jump action is visible (i.e. current node differs from current narration node)
    jumpActionVisible() {
      return !this.playbackActive && this.currentNodeId !== this.currentNarrationNodeId;
    },
    // determines whether jump action is available (i.e. if jumpNarrationToNode action can be triggered from current node)
    jumpActionAvailable() {
      return this.jumpActionVisible && this.narrationTimestamps.findIndex(event => event[0] === this.currentNodeId) !== -1;
    },
    // determines whether feedback prompt is visible (revealed after threshold of revealed items has been reached)
    feedbackPromptVisible() {
      return this.revealedItems.length >= 64;
    },
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
          if (this.playbackActive) {
            this.startExplorationDuringPlayback();
          }

          this.hideChapterListAndIntroPanel();
        });
      });

      // panning/scrolling of flowchart via click-and-drag
      this.flowchartContainer.addEventListener('mousedown', event => {
        // only start panning if drag was not initiated above visible node
        if (!event.target.closest('g[id^=n].teased, g[id^=n].revealed')) {
          if (this.playbackActive) {
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

    // populate this.flowchartNodes with nodes from svg source
    collectFlowchartNodes() {
      const nodes = this.flowchartElement.querySelectorAll('g[id^=n]');

      nodes.forEach(nodeElement => {
        const nodeProperties = nodeElement.id.split('_');
        const nodeId = nodeProperties[0];
        
        this.flowchartNodes[nodeId] = {
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

        this.flowchartNodes[edgeFrom].outgoing.push({
          edge: edgeElement,
          node: this.flowchartNodes[edgeTo]
        });
        this.flowchartNodes[edgeTo].incoming.push({
          edge: edgeElement,
          node: this.flowchartNodes[edgeFrom]
        });

        // if edge is bidirectional, additionally add the same edge in reverse to the destination/origin node
        if (bidirectionalEdge) {
          this.flowchartNodes[edgeTo].outgoing.push({
            edge: edgeElement,
            node: this.flowchartNodes[edgeFrom]
          });
          this.flowchartNodes[edgeFrom].incoming.push({
            edge: edgeElement,
            node: this.flowchartNodes[edgeTo]
          });
        }
      });

      this.collectNarrationChapters();
      this.addMouseListeners();
      this.setCurrentNodeId(this.currentNodeId);
    },

    // populate this.narrationChapters with non-label nodes
    collectNarrationChapters() {
      const alreadyListedPrimaryChapters = [];

      this.narrationTimestamps.forEach(event => {
        const eventId = event[0];
        const eventTimestamp = event[1];

        const node = this.flowchartNodes[eventId];
        const firstItemOrNoDirectRepetition = this.narrationChapters.length === 0 || this.narrationChapters[this.narrationChapters.length - 1].id !== eventId;
        
        if (node.type !== 'label' && firstItemOrNoDirectRepetition) {
          const chapterType = node.type === 'chapter' && alreadyListedPrimaryChapters.indexOf(eventId) === -1
            ? 'primary'
            : 'secondary';

          this.narrationChapters.push({
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

      Object.entries(this.flowchartNodes).forEach(([nodeId, node]) => {
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
      if (forceMovement || !this.playbackActive || travelDistance > this.travelThreshold) {
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
      if (this.revealedItems.indexOf(node.id) === -1) {
        this.revealedItems.push(node.id);
      }
    },

    // add node element to teasedItems array
    markItemAsTeased(node) {
      if (this.teasedItems.indexOf(node.id) === -1) {
        this.teasedItems.push(node.id);
      }
    },

    // add timestamp/event index to listenedTimestampIndexes array
    markTimestampAsListened(index) {
      if (this.listenedTimestampIndexes.indexOf(index) === -1) {
        this.listenedTimestampIndexes.push(index);
      }
    },

    // add chapter index to listenedChapterIndexes array
    markChapterAsListened(index) {
      if (this.listenedChapterIndexes.indexOf(index) === -1) {
        this.listenedChapterIndexes.push(index);
      }
    },

    // update classes/appearance of svg elements
    updateFlowchartAppearance() {
      this.flowchartElement.querySelectorAll('g').forEach(element => {
        element.classList.remove('current', 'next', 'revealed', 'teased');
      });

      this.currentNode.element.classList.add('current');
      this.markItemAsRevealed(this.currentNode.element);

      this.currentNode.outgoing.forEach(item => {
        item.edge.classList.add('next');
        item.node.element.classList.add('next');
        this.markItemAsRevealed(item.edge);
        this.markItemAsRevealed(item.node.element);

        item.node.outgoing.forEach(subsequentItem => {
          this.markItemAsTeased(subsequentItem.edge);
          this.markItemAsTeased(subsequentItem.node.element);
        });
      });

      this.revealedItems.forEach(id => {
        document.getElementById(id).classList.add('revealed');
      });

      this.teasedItems.forEach(id => {
        document.getElementById(id).classList.add('teased');
      });
    },

    // jump playback position to chapter
    jumpNarrationToChapter(index) {
      this.$refs.media.currentTime = this.narrationChapters[index].timestamp;

      // if node of selected chapter is the same as the current narration node, this will not trigger
      // currentNarrationNodeId watcher -> therefore start playback manually
      if (this.narrationChapters[index].id === this.currentNarrationNodeId) {
        this.startPlayback();
      }

      this.logEvent('call_jumpNarrationToChapter');
    },

    // jump playback position to node (either current node or node clicked during playback)
    jumpNarrationToNode(nodeId) {
      const nodeOccurrencesInNarration = this.narrationTimestamps.filter(event => event[0] === nodeId);

      if (nodeOccurrencesInNarration.length !== 0) {
        // if playback is active, jump to the next occurrence after the current playback position or the final one if none exists
        if (this.playbackActive) {
          const nextNodeOccurrenceAfterPlaybackPosition = nodeOccurrencesInNarration.find(event => event[1] >= this.playbackPosition);

          if (nextNodeOccurrenceAfterPlaybackPosition) {
            this.$refs.media.currentTime = nextNodeOccurrenceAfterPlaybackPosition[1];
          } else {
            const lastNodeOccurrence = nodeOccurrencesInNarration[nodeOccurrencesInNarration.length - 1];
            this.$refs.media.currentTime = lastNodeOccurrence[1];
          }
        // if playback is paused, jump to the first unlistened occurrence in narration sequence or the final one if none exists
        } else {
          let furthestNodeOccurrence = ['', 0];

          const noUnlistenedOccurrences = nodeOccurrencesInNarration.every(event => {
            if (this.listenedTimestampIndexes.indexOf(this.narrationTimestamps.indexOf(event)) === -1) {
              this.$refs.media.currentTime = event[1];
              return false;
            } else {
              furthestNodeOccurrence = event;
              return true;
            }
          });

          if (noUnlistenedOccurrences) {
            this.$refs.media.currentTime = furthestNodeOccurrence[1];
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
      this.currentNodeId = nodeId;

      // move to the updated (now current) node ID, unless exploration
      // during playback is active, in which case only refresh appearance
      if (!this.exploringDuringPlayback) {
        this.moveToNode(this.currentNode);
      } else {
        this.updateFlowchartAppearance();
      }
      
      this.toggleChapterList(true);
      this.saveCurrentStateToLocalStorage();
    },

    // save all parameters relevant for restoring the state of the chart to local storage
    saveCurrentStateToLocalStorage() {
      localStorage.setItem('currentNodeId', JSON.stringify(this.currentNodeId));
      localStorage.setItem('teasedItems', JSON.stringify(this.teasedItems));
      localStorage.setItem('revealedItems', JSON.stringify(this.revealedItems));
      localStorage.setItem('listenedTimestampIndexes', JSON.stringify(this.listenedTimestampIndexes));
      localStorage.setItem('listenedChapterIndexes', JSON.stringify(this.listenedChapterIndexes));
      localStorage.setItem('playbackPosition', JSON.stringify(this.playbackPosition));
    },

    // clear local storage and reload the page
    clearLocalStorageAndReload() {
      localStorage.clear();
      location.reload();
    },

    // start playback
    startPlayback(nodeIdAlreadySet = false) {
      this.hideChapterListAndIntroPanel();

      if (!nodeIdAlreadySet) {
        this.setCurrentNodeId(this.currentNarrationNodeId);
      }

      // mark first chapter as listened if playback was started right from the start
      if (this.listenedChapterIndexes.length === 0) {
        this.markChapterAsListened(this.currentNarrationChapterIndex);
      }

      this.$refs.media.play();
      this.playbackActive = true;
      this.requestWakeLock();
    },

    // stop playback
    stopPlayback(openChapterList = false) {
      this.$refs.media.pause();
      this.playbackActive = false;
      this.stopExplorationDuringPlayback();
      this.releaseWakeLock();
      
      if (openChapterList) {
        this.toggleChapterList();
      }
    },

    // toggle playback
    togglePlayback() {
      this.playbackActive ? this.stopPlayback() : this.startPlayback();
    },

    // start exploration during playback and set timeout to return to playback location automatically
    startExplorationDuringPlayback() {
      this.exploringDuringPlayback = true;
      clearTimeout(this.returnToPlaybackTimeout);

      this.returnToPlaybackTimeout = setTimeout(this.stopExplorationDuringPlayback, this.returnToPlaybackDelay);
    },

    // stop exploration during playback
    stopExplorationDuringPlayback(omitMovement = false) {
      this.exploringDuringPlayback = false;
      clearTimeout(this.returnToPlaybackTimeout);
      
      if (this.playbackActive && !omitMovement) {
        this.moveToNode(this.currentNode, true);
      }
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
        nodeId: this.currentNodeId,
        narrationNodeIndex: this.currentNarrationNodeIndex,
        narrationChapterIndex: this.currentNarrationChapterIndex,
        playbackActive: +this.playbackActive,
        playbackPosition: this.playbackPosition,
        chapterListVisible: +this.chapterListVisible,
        introPanelVisible: +this.introPanelVisible
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
    currentNarrationNodeId: function() {
      // suppress updating current node ID and starting playback if state was resumed from storage and this is
      // the first narration node update (triggered by the playbackPosition being returned to the previous value)
      if (this.resumedFromStorage && !this.firstNarrationNodeUpdateAfterResumption) {
        this.firstNarrationNodeUpdateAfterResumption = true;
        // without triggering saveCurrentStateToLocalStorage here, a playbackPosition is 0 is saved until the current node updates
        this.saveCurrentStateToLocalStorage();
        return;
      }

      this.setCurrentNodeId(this.currentNarrationNodeId);

      // start playback if not active already (happens when jumpNarrationToNode triggered)
      if (!this.playbackActive) {
        this.startPlayback(true);
      }
    },

    // when the narration index changes, mark that timestamp/event as listened
    currentNarrationNodeIndex: function() {
      this.markTimestampAsListened(this.currentNarrationNodeIndex);
    },

    // when the narration chapter index changes, mark that chapter as listened
    currentNarrationChapterIndex: function() {
      this.markChapterAsListened(this.currentNarrationChapterIndex);
    },

    // when the node ID changes for the first time, unhide reset prompt; also log any changes
    currentNodeId: function() {
      if (!this.resetPromptVisible) {
        setTimeout(() => {
          this.resetPromptVisible = true;
        }, this.resetPromptDelayAfterInteraction);
      }

      this.logEvent('update_nodeId');
    },

    // log more properties changing
    playbackActive: function() {
      this.logEvent('update_playbackActive');
    },
    chapterListVisible: function() {
      this.logEvent('update_chapterListVisible');
    },
    introPanelVisible: function() {
      this.logEvent('update_introPanelVisible');
    }
  },

  created() {
    // generate unique session ID for logging
    this.sessionId = new Date().getTime() + '_' + Math.random().toString(16).slice(2);

    // append session ID to form URL
    this.formUrl = this.formUrl + '?id=' + this.sessionId;

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
    if (localStorage.getItem('currentNodeId')) {
      this.resumedFromStorage = true;
      this.resetPromptVisible = true;

      this.currentNodeId = JSON.parse(localStorage.getItem('currentNodeId'));
      this.teasedItems = JSON.parse(localStorage.getItem('teasedItems'));
      this.revealedItems = JSON.parse(localStorage.getItem('revealedItems'));
      this.listenedTimestampIndexes = JSON.parse(localStorage.getItem('listenedTimestampIndexes'));
      this.listenedChapterIndexes = JSON.parse(localStorage.getItem('listenedChapterIndexes'));
    }
  },

  mounted() {
    // if resumed from storage, set currentTime of media to playbackPosition from storage
    if (this.resumedFromStorage) {
      this.$refs.media.currentTime = localStorage.getItem('playbackPosition');
    }

    // make spacebar trigger togglePlayback
    document.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Space') {
        event.preventDefault();
        
        this.togglePlayback();
        this.logEvent('input_spacebar');
      } else if (event.key === 'Enter' && this.jumpActionAvailable) {
        event.preventDefault();

        this.jumpNarrationToNode(this.currentNodeId);
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