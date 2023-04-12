<template>
  <div class="flowchart">
      <InlineSvg
        :src="flowchartAsset"
        @loaded="initPanzoom($event)"
      />
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter x="0.05" y="0.05" width="0.9" height="0.9" id="label-obscured">
            <feFlood flood-color="rgba(0,0,0,0.5)"/>
          </filter>
          <!-- <filter x="-0.05" y="-0.05" width="1.1" height="1.1" id="label-next-hover">
            <feFlood flood-color="rgba(241, 27, 130, 0.2)"/>
            <feComposite in="SourceGraphic"/>
          </filter> -->
          <filter x="-0.05" y="-0.05" width="1.1" height="1.1" id="label-current">
            <feFlood flood-color="rgba(241, 27, 130, 1)"/>
            <feComposite in="SourceGraphic"/>
          </filter>
        </defs>
      </svg>
      <button
        v-if="!playbackActive"
        :style="`top: ${unpauseButtonPosition.y}px; left: ${unpauseButtonPosition.x}px`"
        class="unpause"
        @click="startPlayback(true)"
      >
        ▶️
      </button>
      <button
        v-if="!playbackActive && currentNarrationNodeId !== currentNodeId"
        :style="`top: ${jumpButtonPosition.y}px; left: ${jumpButtonPosition.x}px`"
        class="jump"
        @click="jumpNarrationToCurrentNode()"
      >
        ⤵️
      </button>
  </div>
  <audio
    ref="media"
    @play = "startPlayback()"
    @pause = "stopPlayback()"
    @timeupdate="playbackPosition = $event.target.currentTime"
  >
    <source src="/narration.mp4" type="video/mp4" />
  </audio>
  <div class="controls">
    <button @click="togglePlayback()">
      {{ playbackActive ? '⏸️' : '▶️' }}
    </button>
    <select @change="$event => jumpNarrationToChapter($event.target.value)">
      <option
        v-for="(chapter, index) in narrationChapters"
        :key="index"
        :value="index"
        :selected="index === currentNarrationChapterIndex"
      >
        {{ index + 1 }}. {{ chapter.name }}
      </option>
    </select>
  </div>
</template>
  
<script>
import InlineSvg from 'vue-inline-svg';
import panzoom from 'panzoom';

import flowchartImport from '@/assets/flowchart.svg';

export default {
  name: 'FlowchartView',

  components: {
    InlineSvg
  },

  data() {
    return {
      flowchartAsset: '',
      flowchartElement: undefined,
      flowchartNodes: {},

      currentNodeId: 'n001',
      teasedItems: [],
      revealedItems: [],

      narrationChapters: [
        {
          name: 'Is climate change for real?',
          start: 59.5
        },
        {
          name: 'Are we fucked?',
          start: 85.6
        },
        {
          name: 'So… we’re all in this together?',
          start: 206
        },
        {
          name: 'Can we fix it?',
          start: 250
        }
      ],

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
        ['n022', 113],
        ['n016', 115],
        ['n023', 121],
        ['n024', 125],
        ['n025', 128.5],
        ['n026', 132.6],
        ['n027', 163],
        ['n028', 174],
        ['n029', 176],
        ['n028', 179],
        ['n030', 180],
        ['n031', 182],
        ['n032', 184.5],
        ['n033', 189],
        ['n032', 195],
        ['n034', 206],
        ['n035', 209],
        ['n026', 211],
        ['n034', 221],
        ['n037', 233],
        ['n038', 240],
        ['n039', 242]
      ],

      playbackActive: false,
      playbackPosition: 0,

      panzoomInstance: undefined,
      panzoomPosition: {},

      unpauseButtonPosition: {
        x: 0,
        y: 0
      },
      jumpButtonPosition: {
        x: 0,
        y: 0
      }
    }
  },

  computed: { 
    currentNode() {
      return this.flowchartNodes[this.currentNodeId];
    },
    currentNodeLabel() {
      if (this.currentNode.label.length <= 32) {
        return this.currentNode.label;
      } else {
        const words = this.currentNode.label.substring(0, 32).split(' ');
        words.pop();
        return words.join(' ') + '…';
      }
    },
    // current index in narrationTimestamps based on media playback location
    currentNarrationNodeIndex() {  
      return Math.max(this.narrationTimestamps.findIndex(node => node[1] > this.playbackPosition) - 1, 0);
      // return this.narrationTimestamps.findLastIndex(node => node[1] <= this.playbackPosition);
    },
    // node for current narration index
    currentNarrationNodeId() {
      return this.narrationTimestamps[this.currentNarrationNodeIndex][0];
    },
    currentNarrationNode() {
      return this.flowchartNodes[this.currentNarrationNodeId];
    },
    currentNarrationChapterIndex() {
      return this.narrationChapters.findLastIndex(chapter => chapter.start <= this.playbackPosition);
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
      });

      this.panzoomInstance.on('panend', () => {
      });

      this.panzoomInstance.on('transform', () => {
        this.panzoomPosition = this.panzoomInstance.getTransform();
        this.updateFloatingButtonPositions();
      });

      this.flowchartElement = element;
      this.collectFlowchartNodes();
    },

    // populate this.flowchartNodes with nodes and edges from svg source
    collectFlowchartNodes() {
      const nodes = this.flowchartElement.querySelectorAll('g[id^=n]');

      nodes.forEach(nodeElement => {
        const nodeProperties = nodeElement.id.split('_');
        const nodeId = nodeProperties[0];
        
        this.flowchartNodes[nodeId] = {
          element: nodeElement,
          type: nodeProperties[1],
          label: nodeElement.textContent.replaceAll('\n', ' ').trim(),
          outgoing: [],
          incoming: []
        };
      });

      const edges = this.flowchartElement.querySelectorAll('g[id^=e_]');

      edges.forEach(edgeElement => {
        const edgeProperties = edgeElement.id.split('_');
        const edgeFrom = 'n' + edgeProperties[1].split('-')[1];
        const edgeTo = 'n' + edgeProperties[2].split('-')[1];

        this.flowchartNodes[edgeFrom].outgoing.push({
          edge: edgeElement,
          node: this.flowchartNodes[edgeTo]
        });

        this.flowchartNodes[edgeTo].incoming.push({
          edge: edgeElement,
          node: this.flowchartNodes[edgeFrom]
        });
      });

      this.addClickListeners();
    },

    // attach click listeners to flowchart nodes
    addClickListeners() {
      const vueInstance = this;

      Object.entries(this.flowchartNodes).forEach(([nodeId, node]) => {
        node.element.addEventListener('click', function() {
          if (this.classList.contains('revealed')) {
            vueInstance.stopPlayback();
            vueInstance.currentNodeId = nodeId;
          }
        });
      });
    },
    
    markItemAsRevealed(node) {
      if (this.revealedItems.indexOf(node) === -1) {
        this.revealedItems.push(node);
      }
    },

    markItemAsTeased(node) {
      if (this.teasedItems.indexOf(node) === -1) {
        this.teasedItems.push(node);
      }
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

    jumpNarrationToChapter(chapterIndex) {
      this.$refs.media.currentTime = this.narrationChapters[chapterIndex].start;
      this.startPlayback();
    },
    jumpNarrationToCurrentNode() {
      const firstNodeTimestamp = this.narrationTimestamps.find(node => node[0] === this.currentNodeId)[1];
      
      this.$refs.media.currentTime = firstNodeTimestamp;
      this.startPlayback();
    },

    startPlayback(forceRecenter = false) {
      this.currentNodeId = this.currentNarrationNodeId;
      if (forceRecenter) {
        this.moveToNode(this.currentNode);
      }

      this.$refs.media.play();
      this.playbackActive = true;
    },

    stopPlayback() {
      this.$refs.media.pause();
      this.playbackActive = false;
    },

    togglePlayback() {
      if (this.playbackActive) {
        this.stopPlayback();
      } else {
        this.startPlayback();
      }
    },

    updateFloatingButtonPositions() {
      const narrationNodePosition = this.currentNarrationNode.element.getBBox();
      
      this.unpauseButtonPosition = {
        x: narrationNodePosition.x + narrationNodePosition.width / 2 + this.panzoomPosition.x - 14,
        y: narrationNodePosition.y + this.panzoomPosition.y - 24
      };

      const nodePosition = this.currentNode.element.getBBox();
      
      this.jumpButtonPosition = {
        x: nodePosition.x + nodePosition.width / 2 + this.panzoomPosition.x - 16,
        y: nodePosition.y + this.panzoomPosition.y - 24
      };
    },
  },

  watch: {
    currentNode: function() {
      // problem: does not re-center upon playback start if currentNode starts the same
      this.moveToNode(this.currentNode);
    },
    currentNarrationNodeId: function() {
      this.currentNodeId = this.currentNarrationNodeId;
    }
    // playbackPosition: function() {
    //   console.log(this.playbackPosition);
    // }
  },

  mounted() {
    this.flowchartAsset = flowchartImport;

    // temporary
    this.$refs.media.currentTime = this.narrationChapters[0].start;
    // this.playbackPosition = this.narrationChapters[0].start;
  }
}
</script>

<style lang="scss">
.flowchart {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  overflow: hidden;

  &:after {
    display: block;
    position: absolute;
    content: '';
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    // background: radial-gradient(rgba(255,255,255,0) 50%, rgba(255,255,255,0.8) 80%);
    pointer-events: none;
  }

  svg {
    cursor: default;

    // nodes
    g[id^=n] {
      opacity: 0;
      // transform-box: fill-box;
      // transform-origin: center;
      transition: all 0.1s ease-in-out;

      path:last-of-type {
        stroke: rgba(0,0,0,0.75);
      }

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

      // non-label text
      &:not([id$=label]) {
        text {
          fill: transparent;
        }
      }

      // label text
      &[id$=label] {
        text {
          filter: url('#label-obscured');
        }
      }

      // outlines/teasers visible
      &.teased, &.revealed {
        opacity: 0.15;
      }

      // text visible + interactive
      &.revealed {
        &:hover {
          opacity: 0.75;
          cursor: pointer;
          // transform: scale(1.05);
        }

        text {
          fill: initial;
          filter: none;
        }
      }

      // currently active + next options
      &.current, &.next {
        &:hover {
          opacity: 1;
        }

        path:last-of-type {
          stroke: rgba(241, 27, 130, 1);
        }

        &[id$=question] {
          path {
            fill: rgba(241, 27, 130, 0.2);
          }
        }

        text {
          fill: rgba(241, 27, 130, 1);
        }
      }

      // only next options
      &.next {
        opacity: 0.75;

        // &[id$=label] {
        //   text:hover {
        //     filter: url('#label-next-hover');
        //   }
        // }
      }

      // only currently active
      &.current {
        opacity: 1;

        &:not([id$=label]) {
          path {
            fill: rgba(241, 27, 130, 1);
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

      &.teased, &.revealed {
        opacity: 0.15;
      }

      &.next {
        opacity: 0.5;

        path {
          fill: rgba(241, 27, 130, 1);
        }
      }
    }
  }

  button {
    position: absolute;
    appearance: none;
    top: 0;
    left: 0;
    padding: 0;
    font-size: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
  }
}

audio {
  position: absolute;
  bottom: 52px;
  left: 12px;
  width: 360px;
}

.controls {
  position: absolute;
  bottom: 12px;
  left: 16px;
  line-height: 25px;

  button {
    appearance: none;
    margin-right: 12px;
    padding: 0;
    vertical-align: middle;
    font-size: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
  }
}
</style>
