<template>
  <div class="flowchart">
    <InlineSvg
      :src="flowchartAsset"
      @loaded="initPanzoom($event)"
    />
    <InlineSvg :src="filtersAsset" />
  </div>
  <audio ref="media" @timeupdate="playbackPosition = $event.target.currentTime">
    <source src="/narration.mp3" type="audio/mp3" />
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
          <span>{{ chapter.label }} <!-- {{ chapter.repetition ? `(${chapter.repetition})` : '' }} --></span>
        </li>
      </ul>
    </div>
    <button
      class="jump"
      :class="{ available: jumpActionAvailable }"
      title="Resume playback from selected item"
      @click="jumpNarrationToCurrentNode()"
    />
  </div>
</template>
  
<script>
import InlineSvg from 'vue-inline-svg';
import panzoom from 'panzoom';

import flowchartAsset from '@/assets/flowchart.svg';
import filtersAsset from '@/assets/filters.svg';

export default {
  name: 'FlowchartView',

  components: {
    InlineSvg
  },

  data() {
    return {
      flowchartAsset,
      filtersAsset,
      
      flowchartElement: undefined,
      flowchartNodes: {},

      currentNodeId: 'n001',
      teasedItems: [],
      revealedItems: [],

      narrationTimestamps: [
        // Is climate change for real?
        ['n001', 59.5],
        ['n002', 61.5],
        ['n001', 62.9],
        ['n002', 63.9],
        ['n001', 65.2],
        ['n004', 66],
        ['n005', 68.1],
        ['n007', 69.2],
        ['n008', 70.8],
        ['n009', 73.4],
        ['n010', 75.5],
        ['n011', 77.3],
        ['n005', 79.2],
        ['n006', 80.3],
        ['n001', 81.6],
        ['n012', 83.5],
        // Are we fucked?
        ['n013', 85.6],
        ['n014', 86.5],
        ['n013', 88.2],
        ['n014', 88.8],
        ['n013', 89.6],
        ['n015', 90.8],
        ['n016', 103],
        ['n017', 110],
        ['n022', 112.6],
        ['n016', 115],
        ['n023', 121.2],
        ['n024', 125.2],
        ['n025', 128.5],
        ['n026', 132.6],
        ['n027', 162.6],
        ['n028', 174],
        ['n029', 176],
        ['n028', 178.8],
        ['n030', 180],
        ['n031', 181.8],
        ['n032', 184.5],
        ['n033', 189],
        ['n032', 195],
        ['n034', 206],
        ['n035', 208.2],
        ['n026', 211],
        ['n034', 220.8],
        ['n037', 233],
        ['n038', 240]
      ],
      listenedTimestampIndexes: [],

      narrationChapters: [],
      listenedChapterIndexes: [],
      chapterListVisible: false,

      playbackActive: false,
      playbackPosition: 0,

      panzoomInstance: undefined,
      panzoomPosition: {}
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
    // determines whether jumpNarrationToCurrentNode() action can be triggered from current node
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
    // initialize panzoom instance
    initPanzoom(element) {
      this.panzoomInstance = panzoom(element, {
        maxZoom: 1,
        minZoom: 1
      });

      this.panzoomInstance.on('panstart', () => {
        this.stopPlayback();
        this.toggleChapterList(true);
      });

      this.panzoomInstance.on('panend', () => {

      });

      this.panzoomInstance.on('transform', () => {
        this.panzoomPosition = this.panzoomInstance.getTransform();
      });

      this.flowchartElement = element;
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

        this.flowchartNodes[edgeFrom].outgoing.push({
          edge: edgeElement,
          node: this.flowchartNodes[edgeTo]
        });

        this.flowchartNodes[edgeTo].incoming.push({
          edge: edgeElement,
          node: this.flowchartNodes[edgeFrom]
        });
      });

      this.collectNarrationChapters();
      this.addClickListeners();
      this.setCurrentNodeId(this.currentNodeId);
    },

    // populate this.narrationChapters with non-label nodes
    collectNarrationChapters() {
      const repeatingNodes = {};

      this.narrationTimestamps.forEach(event => {
        if (!(event[0] in repeatingNodes)) {
          repeatingNodes[event[0]] = 0;
        } else {
          repeatingNodes[event[0]] = 1;
        }
      });

      this.narrationTimestamps.forEach(event => {
        const eventId = event[0];
        const eventTimestamp = event[1];

        const node = this.flowchartNodes[eventId];
        const firstItemOrNoDirectRepetition = this.narrationChapters.length === 0 || this.narrationChapters[this.narrationChapters.length - 1].id !== eventId;
        
        if (node.type !== 'label' && firstItemOrNoDirectRepetition) {
          let repetitionCounter = 0;

          if (repeatingNodes[eventId] > 0) {
            repetitionCounter = repeatingNodes[eventId];
            repeatingNodes[eventId] += 1;
          }

          this.narrationChapters.push({
            id: eventId,
            element: node.element,
            type: node.type === 'question' ? 'primary' : 'secondary',
            label: node.label,
            repetition: repetitionCounter,
            timestamp: eventTimestamp,
          })
        }
      });

      // temporary: advance initial playback position
      this.$refs.media.currentTime = this.narrationTimestamps[0][1];
    },

    // attach click listeners to node elements
    addClickListeners() {
      const vueInstance = this;

      Object.entries(this.flowchartNodes).forEach(([nodeId, node]) => {
        node.element.addEventListener('click', function() {
          if (this.classList.contains('revealed')) {
            vueInstance.stopPlayback();
            vueInstance.setCurrentNodeId(nodeId);
          }
        });
      });
    },

    // pan the flowchart to center on an item
    moveToNode(item) {
      const method = /*smoothTransition ? */'smoothMoveTo'/* : 'moveTo'*/;
      const position = item.element.getBBox();

      this.panzoomInstance[method](
        -(position.x + position.width / 2 - window.innerWidth / 2),
        -(position.y + position.height / 2 - window.innerHeight / 2),
        1
      );

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
    },

    // jump playback position to current node
    jumpNarrationToCurrentNode() {
      const nodeOccurrencesInNarration = this.narrationTimestamps.filter(event => event[0] === this.currentNodeId);

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
    }
  },

  watch: {
    // when the narration index changes, mark that timestamp/event as listened
    currentNarrationNodeIndex: function() {
      this.markTimestampAsListened(this.currentNarrationNodeIndex);
    },

    // update current node ID upon change of narration node ID (which changes based on playback position)
    currentNarrationNodeId: function() {
      this.setCurrentNodeId(this.currentNarrationNodeId);

      // start playback if not active already (happens when jumpNarrationToCurrentNode triggered)
      if (!this.playbackActive) {
        this.startPlayback(true);
      }
    },

    // when the narration chapter index changes, mark that chapter as listened
    currentNarrationChapterIndex: function() {
      this.markChapterAsListened(this.currentNarrationChapterIndex);
    }
  },

  mounted() {
    // make spacebar trigger togglePlayback
    document.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Space') {
        this.togglePlayback();
        event.preventDefault();
      }
    });
  }
}
</script>

<style lang="scss">
:root {
  --accent-color: 241,27,130;
  --transition-duration: 0.1s;
  --transition-timing: ease-in-out;
}

.flowchart {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  overflow: hidden;

  svg {
    cursor: default;

    // nodes
    g[id^=n] {
      opacity: 0;
      transition: all var(--transition-duration) var(--transition-timing);

      // path:last-of-type {
      //   stroke: rgba(0,0,0,0.75);
      // }

      // // background shapes
      // path {
      //   fill: transparent;
      // }

      // // question nodes
      // &[id$=question] {
      //   path {
      //     fill: rgba(0,0,0,0.2);
      //   }
      // }

      // by default, hide text within non-label nodes
      &:not([id$=label]) {
        text {
          fill: transparent;
        }
      }

      // by default, obscure text within label nodes
      &[id$=label] {
        text {
          filter: url('#label-obscured');
        }
      }

      // teased nodes (not yet revealed/interactive)
      &.teased {
        opacity: 0.125;
        
        &:not(.revealed) {
          path:first-of-type {
            fill: rgba(0,0,0,0.5);
            stroke: transparent;
          }
        }
      }

      // revealed nodes (interactive and text visible)
      &.revealed {
        opacity: 0.25;
        
        &:hover {
          opacity: 0.75;
          cursor: pointer;
        }

        text {
          fill: initial;
          filter: none;
        }
      }

      // next nodes and currently selected node
      &.next, &.current {
        &:hover {
          opacity: 1;
        }

        path:last-of-type {
          stroke: rgb(var(--accent-color));
        }

        &[id$=question] {
          path {
            fill: rgba(var(--accent-color), 0.2);
          }
        }

        text {
          fill: rgb(var(--accent-color));
        }
      }

      // next nodes
      &.next {
        opacity: 0.75;

        // &[id$=label] {
        //   text:hover {
        //     filter: url('#label-next-hover');
        //   }
        // }
      }

      // currently active node
      &.current {
        opacity: 1;

        &:not([id$=label]) {
          path {
            fill: rgb(var(--accent-color));
          }

          text {
            fill: #fff;
          }
        }

        &[id$=label] {
          text {
            fill: #fff;
            filter: url('#label-current');
          }
        }
      }
    }

    // edges
    g[id^=e_] {
      opacity: 0;
      pointer-events: none;

      path {
        fill: rgba(0,0,0,0.75);
      }

      &.teased {
        opacity: 0.15;
      }

      &.revealed {
        opacity: 0.15;
      }

      &.next {
        opacity: 0.5;

        path, text {
          fill: rgb(var(--accent-color));
        }
      }
    }
  }
}

.controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
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
    background-color: #333;
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
    background: rgba(230,230,230,0.8);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-shadow: 0 0 0 2px #fff;
    transition: all var(--transition-duration) var(--transition-timing);

    button.playback {
      position: absolute;
      bottom: 0;
      background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI1NnYyNTZIMFoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMjQwIDEyOHYwYy4wMSA1LjUyLTIuODggMTAuNjUtNy42IDEzLjUxTDg4LjMyIDIyOS42NXYwYy00Ljk1IDMuMDItMTEuMTUgMy4xNC0xNi4yLjN2MGMtNS4wMS0yLjgtOC4xMi04LjA5LTguMTItMTMuODJWMzkuODdoLS4wMDFjMC01Ljc0IDMuMTEtMTEuMDMgOC4xMi0xMy44MnYtLjAwMWM1LjA1LTIuODUgMTEuMjUtMi43MyAxNi4yLjNsMTQ0LjA4IDg4LjE0djBjNC43MiAyLjg1IDcuNjEgNy45OCA3LjYgMTMuNTFaIi8+PC9zdmc+');
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
      background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI1NnYyNTZIMFoiLz48cGF0aCBkPSJNNTYuNDggMTY4LjQ4bDgwLTgwSDExOS41bDgwIDgwYzQuNjggNC42OCAxMi4yOCA0LjY4IDE2Ljk3IDAgNC42OC00LjY5IDQuNjgtMTIuMjkgMC0xNi45OGwtODAtODBjLTQuNjktNC42OS0xMi4yOS00LjY5LTE2Ljk4IDBsLTgwIDgwYy00LjY5IDQuNjgtNC42OSAxMi4yOCAwIDE2Ljk3IDQuNjggNC42OCAxMi4yOCA0LjY4IDE2Ljk3IDBaIi8+PC9zdmc+');
      box-shadow: inset 0 1px 0 transparent;
      transition: box-shadow var(--transition-duration) var(--transition-timing);
      cursor: pointer;
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
        padding: 8px 0 8px 80px;
        font-weight: 650;
        background-size: 10px;
        background-position: center left 27px;
        background-repeat: no-repeat;
        cursor: default;

        &.secondary {
          // padding-left: 96px;
          // font-style: italic;
          // color: rgba(0,0,0,0.5);

          &:before {
            content: '—';
            opacity: 0.25;
            margin-right: 6px;
            font-weight: normal;
          }
        }

        &.revealed {
          cursor: pointer;
        }

        &.revealed:hover:not(.active) {
          background-color: rgba(0,0,0,0.075);
        }

        &:not(.revealed) span {
          filter: url('#chapter-obscured');
          opacity: 0.1;
        }

        &.revealed:not(.listened):not(.active) {
          background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI1NnYyNTZIMFoiLz48cGF0aCBmaWxsPSJyZ2JhKDAsMCwwLC4yKSIgZD0iTTEyOCAyNGExMDQgMTA0IDAgMSAwIDAgMjA4IDEwNCAxMDQgMCAxIDAgMC0yMDhaIi8+PC9zdmc+');
        }

        &.listened {
          font-weight: normal;
        }

        &.active {
          font-weight: normal;
          color: #fff;
          background-size: 18px;
          background-position: center left 23px;
          background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0iI0ZGRiI+PHBhdGggZD0iTTIgMTAuNTljMC0uNTYgMC0uODUuMS0xLjA2IC4wOS0uMTkuMjQtLjM1LjQzLS40NCAuMjEtLjExLjQ5LS4xMSAxLjA1LS4xMWgxLjczYy4yNCAwIC4zNiAwIC40OC0uMDMgLjEtLjAzLjE5LS4wNy4yOC0uMTIgLjEtLjA3LjE4LS4xNS4zNi0uMzNsMy4xNi0zLjE3Yy40Mi0uNDMuNjQtLjY1LjgyLS42NiAuMTUtLjAyLjMxLjA1LjQxLjE3IC4xMS4xNC4xMS40NC4xMSAxLjA0djEyLjEzYzAgLjYgMCAuOS0uMTIgMS4wNCAtLjExLjEyLS4yNi4xOC0uNDIuMTcgLS4xOS0uMDItLjQtLjIzLS44My0uNjZsLTMuMTctMy4xN2MtLjE4LS4xOC0uMjYtLjI2LS4zNy0uMzMgLS4wOS0uMDYtLjE5LS4xLS4yOS0uMTIgLS4xMi0uMDMtLjI0LS4wMy0uNDktLjAzSDMuNWMtLjU3IDAtLjg1IDAtMS4wNi0uMTEgLS4xOS0uMS0uMzUtLjI1LS40NC0uNDQgLS4xMS0uMjItLjExLS41LS4xMS0xLjA2di0yLjhaIi8+PHBhdGggZD0iTTMgMTAuNTljMC0uNSAwLS42MiAwLS42IC0uMDEgMC0uMDEgMC0uMDEgMCAtLjAyIDAgLjEtLjAxLjYtLjAxaDEuNzNjLjM5IDAgLjUtLjAxLjcxLS4wNiAuMi0uMDUuMzktLjEzLjU3LS4yNCAuMDUtLjA0LjA1LS4wNC4wOS0uMDcgLjEzLS4xLjItLjE3LjQ0LS40MWwzLjE2LTMuMTdjLjI2LS4yNy4zNi0uMzYuNDMtLjQzIC0uMDIgMC0uMDguMDQtLjI1LjA1IC0uMTYuMDEtLjMyLS4wNi0uNDItLjE4IC0uMTEtLjEzLS4xMy0uMi0uMTQtLjIyIDAgLjEuMDEuMjMuMDEuNjF2MTIuMTNjMCAuMzgtLjAxLjUtLjAyLjYxIDAtLjAyLjAyLS4wOS4xMy0uMjIgLjEtLjEzLjI1LS4xOS40MS0uMTggLjE2LjAxLjIzLjA0LjI0LjA1IC0uMDgtLjA3LS4xOC0uMTYtLjQ0LS40M2wtMy4xNy0zLjE3Yy0uMjktLjI5LS4zNy0uMzYtLjU1LS40NyAtLjE4LS4xMS0uMzgtLjItLjU4LS4yNCAtLjIxLS4wNi0uMzItLjA2LS43Mi0uMDZIMy40OGMtLjUgMC0uNjItLjAxLS42IDAgLS4wMS0uMDEtLjAxIDAtLjAxIDAgMCAuMDEtLjAxLS4xMS0uMDEtLjYxdi0yLjhabS0yIDB2Mi44YzAgLjkuMDEgMS4xMS4yMSAxLjUgLjE5LjM3LjQ5LjY4Ljg3Ljg3IC4zOS4yLjYuMjEgMS41LjIxaDEuNzNjLjIxIDAgLjI1IDAgLjI0LS4wMSAwIDAgMCAwIDAgMCAtLjAxLS4wMS4wMi4wMi4xNy4xN2wzLjE2IDMuMTZjLjgxLjgxLjkyLjkgMS40NS45NCAuNDcuMDMuOTQtLjE2IDEuMjUtLjUzIC4zNC0uNDEuMzUtLjU0LjM1LTEuN1Y1Ljg2YzAtMS4xNi0uMDItMS4zLS4zNi0xLjcgLS4zMi0uMzctLjc4LS41Ni0xLjI2LS41MyAtLjU0LjA0LS42NC4xMi0xLjQ2Ljk0TDUuNjggNy43M2MtLjE1LjE0LS4xOS4xNy0uMTkuMTggMC0uMDEgMC0uMDEuMDEtLjAxIC0uMDEgMC0uMDEgMC0uMDEgMCAwLS4wMS0uMDQtLjAxLS4yNS0uMDFIMy41Yy0uOTEgMC0xLjEyLjAxLTEuNTEuMjEgLS4zOC4xOS0uNjkuNDktLjg4Ljg3IC0uMjEuMzktLjIyLjYtLjIyIDEuNVoiLz48cGF0aCBkPSJNMTguOTMgNS41OGMxLjMzIDEuODUgMi4wNiA0LjA3IDIuMDYgNi40MSAwIDIuMzMtLjczIDQuNTYtMi4wNyA2LjQxIC0uMzMuNDQtLjIzIDEuMDcuMjIgMS4zOSAuNDQuMzIgMS4wNy4yMiAxLjM5LS4yMyAxLjU3LTIuMiAyLjQ0LTQuODMgMi40NC03LjU5cy0uODctNS40LTIuNDUtNy41OWMtLjMzLS40NS0uOTUtLjU2LTEuNC0uMjMgLS40NS4zMi0uNTYuOTQtLjIzIDEuMzlabS00LjAyIDIuOThjLjY5Ljk5IDEuMDcgMi4xOCAxLjA3IDMuNDIgMCAxLjI0LS4zOCAyLjQyLTEuMDggMy40MiAtLjMyLjQ1LS4yMSAxLjA3LjI0IDEuMzkgLjQ1LjMxIDEuMDcuMiAxLjM5LS4yNSAuOTItMS4zNCAxLjQzLTIuOTIgMS40My00LjU4IDAtMS42Ni0uNTEtMy4yNS0xLjQ0LTQuNTggLS4zMi0uNDYtLjk0LS41Ny0xLjQtLjI1IC0uNDYuMzEtLjU3LjkzLS4yNSAxLjM5WiIvPjwvZz48L3N2Zz4=');
          background-color: rgba(0,0,0,0.5);
        }


        &:first-child {
          margin-top: 24px;
        }

        &:last-child {
          margin-bottom: 24px;
        }
      }
    }

    &.playing {
      width: 64px;

      button.playback {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI1NnYyNTZIMFoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMjE2IDQ4djE2MCAwYzAgOC44My03LjE3IDE2LTE2IDE2aC00MHYwYy04Ljg0IDAtMTYtNy4xNy0xNi0xNlY0OHYwYzAtOC44NCA3LjE2LTE2IDE2LTE2aDQwdjBjOC44MyAwIDE2IDcuMTYgMTYgMTZaTTk2IDMySDU2djBjLTguODQgMC0xNiA3LjE2LTE2IDE2djE2MCAwYzAgOC44MyA3LjE2IDE2IDE2IDE2aDQwdjBjOC44MyAwIDE2LTcuMTcgMTYtMTZWNDh2MGMwLTguODQtNy4xNy0xNi0xNi0xNloiLz48L3N2Zz4=');
      }
    }

    &:not(.playing).chapters {
      height: 336px;

      .current-chapter {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI1NnYyNTZIMFoiLz48cGF0aCBkPSJNMTk5LjUxIDg3LjUxbC04MCA4MGgxNi45N2wtODAtODBjLTQuNjktNC42OS0xMi4yOS00LjY5LTE2Ljk4IDAgLTQuNjkgNC42OC00LjY5IDEyLjI4IDAgMTYuOTdsODAgODBjNC42OCA0LjY4IDEyLjI4IDQuNjggMTYuOTcgMGw4MC04MGM0LjY4LTQuNjkgNC42OC0xMi4yOSAwLTE2Ljk4IC00LjY5LTQuNjktMTIuMjktNC42OS0xNi45OCAwWiIvPjwvc3ZnPg==');
        box-shadow: inset 0 1px 0 rgba(0,0,0,0.1);
      }
    }
  }

  button.jump {
    position: relative;
    visibility: hidden;
    opacity: 0;
    margin-left: 12px;
    background-image: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI1NnYyNTZIMFoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMjA4IDQwdjE3NiAwYzAgNC40MS0zLjU5IDgtOCA4IC00LjQyIDAtOC0zLjU5LTgtOHYtNjkuMjNMNzIuNDMgMjIxLjU1aC0uMDAxYy03LjQ3IDQuNjgtMTcuMzEgMi40My0yMS45OS01LjAzIC0xLjU5LTIuNTItMi40My01LjQzLTIuNDUtOC40MVY0Ny44N3YwYy4wNC04LjgxIDcuMjEtMTUuOTIgMTYuMDItMTUuODggMi45Ny4wMSA1Ljg4Ljg2IDguNCAyLjQ0bDExOS41NyA3NC43OFYzOS45OHYwYzAtNC40MiAzLjU4LTggOC04IDQuNDEgMCA4IDMuNTggOCA4WiIvPjwvc3ZnPg==');
    background-color: rgb(var(--accent-color));
    box-shadow: 0 0 0 2px #fff;
    transition: all var(--transition-duration) var(--transition-timing);

    &.available {
      visibility: visible;
      opacity: 1;
    }
  }
}
</style>
