<template>
  <div id="flowchart" class="flowchart">
    <InlineSvg
      :src="flowchartAsset"
      :class="{ ready: flowchartElement }"
      @loaded="initZoom($event)"
    />
  </div>
  <audio ref="media" @timeupdate="playbackPosition = $event.target.currentTime">
    <source src="@/data/narration.m4a" type="audio/mp4" />
  </audio>
  <div class="controls">
    <div class="narration" :class="{ playing: playbackActive, chapters: chapterListVisible }">
      <button
        class="playback"
        :class="{ current: currentNodeId === currentNarrationNodeId }"
        :title="playbackActive ? 'Pause narration playback' : 'Resume narration playback'"
        @click="togglePlayback()"
      />
      <div
        class="current-chapter"
        :title="chapterListVisible ? 'Close narration log' : 'Open narration log'"
        @click="toggleChapterList()"
      >
        <span v-if="currentNarrationChapter">
          {{ currentNarrationChapter.label }}
        </span>
      </div>
      <ul ref="chapters" class="chapters">
        <li
          v-for="(chapter, index) in narrationChapters"
          :key="index"
          :class="[
            chapter.type,
            revealedItems.indexOf(chapter.element) !== -1 ? 'revealed' : '',
            index === currentNarrationChapterIndex ? 'active' : '',
            listenedChapterIndexes.indexOf(index) !== -1 ? 'listened' : ''
          ]"
          @click="revealedItems.indexOf(chapter.element) !== -1 && jumpNarrationToChapter(index)"
        >
          <span>{{ chapter.label }}</span>
        </li>
      </ul>
    </div>
    <button
      class="jump"
      :class="{ available: jumpActionAvailable }"
      title="Resume playback from selected item"
      @click="jumpNarrationToNode(currentNodeId)"
    />
  </div>
</template>
  
<script>
import InlineSvg from 'vue-inline-svg';
import * as d3 from 'd3';

import flowchartAsset from '@/assets/flowchart.svg';
import narrationTimestamps from '@/data/timestamps.json';

export default {
  name: 'FlowchartView',

  components: {
    InlineSvg
  },

  data() {
    return {
      sessionId: undefined,

      flowchartAsset,

      zoomBehavior: undefined,
      selectedFlowchartContainer: undefined,
      
      flowchartElement: undefined,
      flowchartNodes: {},

      currentNodeId: 'n001',
      teasedItems: [],
      revealedItems: [],

      narrationTimestamps,
      listenedTimestampIndexes: [],

      narrationChapters: [],
      listenedChapterIndexes: [],
      chapterListVisible: false,

      playbackActive: false,
      playbackPosition: 0,
      
      mousePressedAboveNode: false,

      movementParameters: {
        screenSizeFactor: 0.15,
        maxTravelThreshold: 256,
        distanceFactor: 1.5,
        minDuration: 333,
        maxDuration: 1000
      }
    }
  },

  computed: {
    // current node object
    currentNode() {
      return this.flowchartNodes[this.currentNodeId];
    },
    // current index in narrationTimestamps based on media playback position
    currentNarrationNodeIndex() {  
      // return Math.max(this.narrationTimestamps.findLastIndex(event => event[1] <= this.playbackPosition), 0);
      // return Math.max(this.narrationTimestamps.findIndex(event => event[1] > this.playbackPosition) - 1, 0);

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
      // return Math.max(this.narrationChapters.findIndex(chapter => chapter.timestamp > this.playbackPosition) - 1, 0);

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
    // determines whether jumpNarrationToNode action can be triggered from current node
    jumpActionAvailable() {
      if (
        !this.playbackActive
        && this.currentNodeId !== this.currentNarrationNodeId && this.currentNodeId
        && this.narrationTimestamps.findIndex(event => event[0] === this.currentNodeId) !== -1
      ) {
        return true;
      } else {
        return false;
      }
    }
  },

  methods: {
    // initialize D3 zoom
    initZoom(element) {
      this.flowchartElement = element;
      this.selectedFlowchartContainer = d3.select('#flowchart');

      const chartDimensions = element.getBoundingClientRect();

      this.zoomBehavior = d3.zoom()
        .translateExtent([
          [-window.innerWidth / 2, -window.innerHeight / 2],
          [chartDimensions.width * 2 + window.innerWidth / 2, chartDimensions.height * 2 + window.innerHeight / 2]
        ])
        .scaleExtent([1, 1])
        .interpolate(d3.interpolateZoom.rho(0))
        .clickDistance([16]);

      this.zoomBehavior.on('zoom', event => {
        this.selectedFlowchartContainer.select('svg g').attr('transform', event.transform.toString());
      });

      this.zoomBehavior.on('start', event => {
        // stop playback and hide chapter list when movement has been triggered by user interaction
        if (event.sourceEvent) {
          if (!this.mousePressedAboveNode) {
            this.stopPlayback();
          }
          this.toggleChapterList(true);

          // DOES NOT WORK: log this as the start of a pan interaction
          // this.logEvent('input_panstart');
        }
      });

      this.zoomBehavior.on('end', () => {
        // set mousePressedAboveNode back to false when movement ends (in case it was true)
        this.mousePressedAboveNode = false;
      });

      this.selectedFlowchartContainer.call(this.zoomBehavior);

      this.selectedFlowchartContainer.on('wheel.zoom', event => {
        event.preventDefault();

        const k = this.selectedFlowchartContainer.property('__zoom').k || 1;

        if (event.ctrlKey) {
          // const nextZoom = k * Math.pow(2, -event.deltaY * 0.01);
          // this.zoomBehavior.scaleTo(this.selectedFlowchartContainer, nextZoom, pointer(event));
        } else {
          this.zoomBehavior.translateBy(
            this.selectedFlowchartContainer,
            -(event.deltaX / k),
            -(event.deltaY / k)
          );
        }

        this.stopPlayback();
        this.toggleChapterList(true);
      });
      // .on('wheel', event => event.preventDefault())

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
          outgoing: []
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

        // if edge is bidirectional, additionally add the same edge in reverse to the destination node
        if (bidirectionalEdge) {
          this.flowchartNodes[edgeTo].outgoing.push({
            edge: edgeElement,
            node: this.flowchartNodes[edgeFrom]
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
          const chapterType = node.type === 'question' && alreadyListedPrimaryChapters.indexOf(eventId) === -1
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

      // temporary: advance initial playback position
      this.$refs.media.currentTime = this.narrationTimestamps[0][1];
    },

    // attach click listeners to node elements
    addMouseListeners() {
      const vueInstance = this;

      Object.entries(this.flowchartNodes).forEach(([nodeId, node]) => {
        node.element.addEventListener('click', function() {
          if (this.classList.contains('revealed')) {
            // if event is triggered during playback (and does not originate from the node already active),
            // jump narration position to that node; otherwise set node ID without affecting narration
            if (vueInstance.playbackActive && nodeId !== vueInstance.currentNodeId) {
              vueInstance.jumpNarrationToNode(nodeId);
            } else {
              // vueInstance.stopPlayback();
              vueInstance.setCurrentNodeId(nodeId);
            }
          }

          vueInstance.logEvent('input_clickNode');
        });

        // upon mousedowning revealed node, set mousePressedAboveNode property to true
        // to prevent playback from being stopped 
        node.element.addEventListener('mousedown', function() {
          if (vueInstance.revealedItems.indexOf(node.element) !== -1) {
            vueInstance.mousePressedAboveNode = true;
          }
        });
      });
    },

    // pan the flowchart to center on an item
    moveToNode(item) {
      const itemPosition = item.element.getBBox();
      const destinationCoords = {
        x: itemPosition.x + itemPosition.width / 2,
        y: itemPosition.y + itemPosition.height / 2 + window.innerHeight * 0.05
      };

      const currentTransform = d3.zoomTransform(this.flowchartElement);
      const currentCoords = {
        x: -currentTransform.x + window.innerWidth / 2,
        y: -currentTransform.y + window.innerHeight / 2
      };

      const travelDistance = Math.sqrt(
        Math.pow(currentCoords.x - destinationCoords.x, 2) + Math.pow(currentCoords.y - destinationCoords.y, 2)
      );

      // TODO: store somewhere else
      const travelThreshold = Math.min(
        Math.min(window.innerWidth, window.innerHeight) * this.movementParameters.screenSizeFactor,
        this.movementParameters.maxTravelThreshold
      );
      
      // omit movement if playback is active and distance from viewport center to destination node falls below threshold
      if (!this.playbackActive || travelDistance > travelThreshold) {
        this.zoomBehavior.translateTo(
          this.selectedFlowchartContainer
            // .interrupt('move')
            .transition('move')
            .ease(d3.easeExpOut)
            // duration dependent on travel distance between min and max thresholds
            .duration(Math.min(
              Math.max(travelDistance * this.movementParameters.distanceFactor, this.movementParameters.minDuration),
              this.movementParameters.maxDuration
            )),
          destinationCoords.x,
          destinationCoords.y
        );
      }

      this.updateFlowchartAppearance();
    },

    // add node element to revealedItems array
    markItemAsRevealed(node) {
      if (this.revealedItems.indexOf(node) === -1) {
        this.revealedItems.push(node);
      }
    },

    // add node element to teasedItems array
    markItemAsTeased(node) {
      if (this.teasedItems.indexOf(node) === -1) {
        this.teasedItems.push(node);
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

      this.revealedItems.forEach(node => {
        node.classList.add('revealed');
      });

      this.teasedItems.forEach(node => {
        node.classList.add('teased');
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

    // jump playback position to current node
    jumpNarrationToNode(nodeId) {
      const nodeOccurrencesInNarration = this.narrationTimestamps.filter(event => event[0] === nodeId);

      if (nodeOccurrencesInNarration.length !== 0) {
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
      } else {
        // if destination node does not occur within narration (happens when jump is triggered through node’s
        // click event while playback is active), stop playback and update the current node ID instead
        this.stopPlayback();
        this.setCurrentNodeId(nodeId);
      }

      this.logEvent('call_jumpNarrationToNode');
    },

    setCurrentNodeId(nodeId) {
      this.currentNodeId = nodeId;

      this.moveToNode(this.currentNode);
      this.toggleChapterList(true);
    },

    // start playback
    startPlayback(nodeIdAlreadySet = false) {
      if (!nodeIdAlreadySet) {
        this.setCurrentNodeId(this.currentNarrationNodeId);
      }

      // mark first chapter as listened if playback was started right from the start
      if (this.listenedChapterIndexes.length === 0) {
        this.markChapterAsListened(this.currentNarrationChapterIndex);
      }

      this.$refs.media.play();
      this.playbackActive = true;

      this.toggleChapterList(true);
    },

    // stop playback
    stopPlayback() {
      this.$refs.media.pause();
      this.playbackActive = false;
    },

    // toggle playback
    togglePlayback() {
      this.playbackActive ? this.stopPlayback() : this.startPlayback();
    },

    // toggle visibility of chapter list
    toggleChapterList(forceClose = false) {
      if (forceClose || this.chapterListVisible) {
        this.chapterListVisible = false;
      } else {
        this.$refs.chapters.querySelector('li.active').scrollIntoView({
          behavior: 'instant',
          block: 'center'
        });

        this.chapterListVisible = true;
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
    },

    // log an event via a post request
    logEvent(eventType, additionalData = {}) {
      const currentState = {
        nodeId: this.currentNodeId,
        narrationNodeIndex: this.currentNarrationNodeIndex,
        narrationChapterIndex: this.currentNarrationChapterIndex,
        playbackActive: +this.playbackActive,
        playbackPosition: this.playbackPosition,
        chapterListVisible: +this.chapterListVisible
      };

      fetch('http://localhost/bc-instrumentation/log.php', {
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
      // }).then(response => {
      //   return response;
      // }).then(jsonResponse => {
      //   console.log(jsonResponse);
      }).catch(error => {
        console.log(error);
      });
    }
  },

  watch: {
    // update current node ID upon change of narration node ID (which changes based on playback position)
    currentNarrationNodeId: function() {
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

    // log certain properties changing
    currentNodeId: function() {
      this.logEvent('update_nodeId');
    },
    playbackActive: function() {
      this.logEvent('update_playbackActive');
    },
    chapterListVisible: function() {
      this.logEvent('update_chapterListVisible');
    }
  },

  created() {
    // generate unique session ID for logging
    this.sessionId = new Date().getTime() + '_' + Math.random().toString(16).slice(2);
  },

  mounted() {
    // make spacebar trigger togglePlayback
    document.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Space') {
        this.togglePlayback();
        event.preventDefault();

        this.logEvent('input_spacebar');
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
  }
}
</script>

<style lang="scss">
@import '@/assets/variables.css';

#flowchart {
  position: absolute;
  overflow: hidden;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;

  *::selection {
    background: transparent;
  }

  svg:first-of-type {
    opacity: 0;
    visibility: hidden;
    cursor: default;
    transition: opacity 0.25s var(--transition-timing), visibility 0.25s var(--transition-timing);

    &.ready {
      opacity: 1;
      visibility: visible;
    }

    // nodes
    g[id^=n] {
      opacity: 0;

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
        }

        &:hover {
          cursor: pointer;

          path {
            opacity: 0.5;
          }

          text {
            fill: #fff;
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

.controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  width: 460px;
  font-size: 15px;
  line-height: 20px;
  pointer-events: none;

  > * {
    vertical-align: bottom;
    pointer-events: all;
  }

  *::selection {
    background: transparent;
  }

  button {
    width: 64px;
    height: 64px;
    padding: 0;
    appearance: none;
    border: none;
    border-radius: 100%;
    background-size: 32px;
    background-position: center;
    background-repeat: no-repeat;
    background-color: rgba(255,255,255,0.4);
    cursor: pointer;
    transition: background-color var(--transition-duration) var(--transition-timing);
  }

  .narration {
    position: relative;
    display: inline-block;
    overflow: hidden;
    width: 384px;
    height: 64px;
    border-radius: 32px;
    color: #fff;
    background: rgba(90,90,90,0.75);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-shadow: 0 0 0 2px var(--background-color);
    transition: all var(--transition-duration) var(--transition-timing);

    button.playback {
      position: absolute;
      bottom: 0;
      background-image: url('@/assets/icons/play.svg');
      z-index: 1;

      &.current {
        background-color: rgb(var(--accent-color));
      }
    }

    .current-chapter {
      position: absolute;
      display: flex;
      align-items: center;
      bottom: 0;
      left: 32px;
      width: 304px;
      height: 64px;
      padding-left: 48px;
      background-size: 18px;
      background-position: center right 20px;
      background-repeat: no-repeat;
      background-image: url('@/assets/icons/chevron-up.svg');
      box-shadow: inset 0 1px 0 transparent;
      transition: box-shadow var(--transition-duration) var(--transition-timing);
      cursor: pointer;

      span {
        padding-bottom: 1px;
      }
    }

    ul.chapters {
      position: absolute;
      overflow-y: auto;
      bottom: 64px;
      width: 384px;
      height: 272px;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        padding: 6.5px 0 7.5px 80px;
        font-weight: 600;
        background-size: 8px;
        background-position: center left 28px;
        background-repeat: no-repeat;
        cursor: default;

        &.revealed {
          cursor: pointer;
        }

        &.revealed:hover:not(.active) {
          background-color: rgba(255,255,255,0.125);
        }

        &:not(.revealed) span {
          color: transparent;
          background: rgba(0,0,0,0.4);
        }

        &.revealed:not(.listened):not(.active) {
          background-image: url('@/assets/icons/new.svg');
        }

        &.listened {
          font-weight: normal;
        }

        &.active {
          font-weight: normal;
          color: #fff;
          background-size: 18px;
          background-position: center left 23px;
          background-image: url('@/assets/icons/playing.svg');
          background-color: rgba(255,255,255,0.25);
        }

        &.primary {
          position: relative;
          margin-top: 24px;

          &:not(:first-child):before {
            position: absolute;
            display: block;
            content: '';
            top: -12px;
            left: 0;
            right: 0;
            height: 1px;
            background: rgba(255,255,255,0.15);
          }
        }

        &:first-child {
          margin-top: 24px;
        }

        &:last-child {
          margin-bottom: 24px;
        }

        span {
          display: inline-block;
        }
      }
    }

    &.playing {
      width: 64px;

      button.playback {
        background-image: url('@/assets/icons/pause.svg');
      }
    }

    &:not(.playing).chapters {
      height: 336px;

      .current-chapter {
        background-image: url('@/assets/icons/chevron-down.svg');
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
      }
    }
  }

  button.jump {
    position: relative;
    visibility: hidden;
    opacity: 0;
    margin-left: 12px;
    background-image: url('@/assets/icons/jump.svg');
    background-color: rgb(var(--accent-color));
    box-shadow: 0 0 0 2px var(--background-color);
    transition: all var(--transition-duration) var(--transition-timing);

    &.available {
      visibility: visible;
      opacity: 1;
    }
  }
}
</style>
