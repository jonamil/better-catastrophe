<template>
  <div class="flowchart">
      <InlineSvg
        :src="flowchartAsset"
        @loaded="initPanzoom($event)"
      />
  </div>
  <img
    ref="face"
    src="@/assets/boyd.jpg"
  />
  <audio
    ref="media"
    @play = "playbackActive = true"
    @pause = "playbackActive = false"
    @timeupdate="playbackPosition = $refs.media.currentTime"
    controls
  >
    <source src="/narration.mp4" type="video/mp4" />
  </audio>
  <div class="controls">
    <template v-if="!explorationMode">
      Narration Step {{ currentNarrationIndex + 1 }} of {{ narrationSequence.length }}
    </template>
    <template v-else>
      <button @click="endExplorationMode()">Return to Narration</button>
      &nbsp;
      {{ currentExplorationId ?? 'Nothing' }} focused
      &nbsp;
      <button v-if="currentExplorationId" @click="resumeNarrationFromExplorationItem">Resume Narration Here</button>
    </template>
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
      explorationMode: false,
      currentExplorationId: undefined,
      pastExplorationItems: [],

      flowchartAsset: '',
      flowchartElement: undefined,
      flowchartItems: {},

      narrationSequence: [
        ['n001', 59.5], ['e002', 61.5],
        ['n001', 62.9], ['e002', 63.9],
        ['n001', 65.2], ['e004', 66],
        ['n002', 68.1],
        ['n003', 69.2], ['e007-01', 70.8], ['e007-02', 73.4], ['e007-03', 75.5], ['e007-04', 77.3],
        ['n002', 79.2], ['e005', 80.3],
        ['n001', 81.6], ['e008', 83.5],
        ['n004', 85.6], ['e010', 86.5],
        ['n004', 88.2], ['e010', 88.8],
        ['n004', 89.6], ['e009', 90.8],
        ['n005', 300],
        ['n006', 300], ['e012', 300],
        ['n006', 300],
        ['n005', 300], ['e013-01', 300], ['e013-02', 300], ['e013-03', 300],
        ['n008', 300],
        ['n005', 300],
        ['n007', 300], ['e014-01', 300], ['e014-02', 300], ['e014-01', 300], ['e014-03', 300], ['e014-04', 300],
        ['n009', 300], ['e015', 300],
        ['n009', 300],
        ['n010', 300], ['e019', 300],
        ['n008', 300], ['e018', 300],
        ['n010', 300], ['e020-01', 300], ['e020-02', 300], ['e020-03', 300],
        ['n011', 300]
      ],

      playbackActive: false,
      playbackPosition: 0,

      volumeAdjustment: {
        duration: 250,
        interval: undefined,
        timeout: undefined,
        start: 0,
        from: 0,
        to: 0
      },

      panzoomInstance: undefined,
      panzoomPosition: {},

      distanceToCurrentNarrationItem: 0
    }
  },

  computed: {
    // current index in narrationSequence based on media playback location
    currentNarrationIndex() {
      return Math.max(this.narrationSequence.findIndex(event => event[1] > this.playbackPosition) - 1, 0);
    },
    // item object for current narration index
    currentNarrationItem() {
      return this.flowchartItemForSequenceIndex(this.currentNarrationIndex);
    },
    // item object for current exploration ID
    currentExplorationItem() {
      if (this.currentExplorationId) {
        return this.flowchartItemForId(this.currentExplorationId);
      } else {
        return undefined;
      }
    },
  },

  methods: {
    // initialize panzoom instance
    initPanzoom(element) {
      this.panzoomInstance = panzoom(element, {
        maxZoom: 1,
        minZoom: 1
      });

      this.panzoomInstance.on('panstart', () => {
        // this.currentExplorationId = undefined;
        this.startExplorationMode();
        this.$refs.face.classList.add('pan');
      });

      this.panzoomInstance.on('panend', () => {
        this.$refs.face.classList.remove('pan');
      });

      this.panzoomInstance.on('transform', () => {
        this.panzoomPosition = this.panzoomInstance.getTransform();
        this.updateNarrationVolume();
      });

      this.flowchartElement = element;
      this.collectFlowchartItems();
    },

    // populate this.flowchartItems with nodes, edges and labels from svg source
    collectFlowchartItems() {
      const nodes = this.flowchartElement.querySelectorAll('[id^=n0]');

      nodes.forEach(nodeElement => {
        const nodeProperties = nodeElement.id.split('_');
        const nodeId = nodeProperties[0];
        
        this.flowchartItems[nodeId] = {
          type: nodeProperties[1],
          element: nodeElement
        };
      });

      const edges = this.flowchartElement.querySelectorAll('[id^=e0]');

      edges.forEach(edgeElement => {
        let edgeProperties = edgeElement.id.split('_');
        const edgeId = edgeProperties.shift();

        const edgeObject = {
          type: 'edge',
          element: edgeElement,
          labels: {}
        }

        edgeProperties = edgeProperties.map(property => property.split('-'));

        edgeProperties.forEach(property => {
          const propertyName = property.shift();
          edgeObject[propertyName] = property.length > 1 ? property : property[0];
        });

        this.flowchartItems[edgeId] = edgeObject;
      });

      const labels = this.flowchartElement.querySelectorAll('[id^=l_]');

      labels.forEach(labelElement => {
        const labelProperties = labelElement.id.split('_');
        const labelIndex = labelProperties[2] ?? '01';

        const labelObject = {
          type: 'label',
          index: labelIndex,
          parent: labelProperties[1].split('-')[1],
          element: labelElement
        };

        const parentEdge = this.flowchartItems['e' + labelObject.parent];

        if (parentEdge) {
          parentEdge.labels[labelIndex] = labelObject;
        }
      });

      this.addEventListeners();
    },

    // return object from this.flowchartItems for item ID
    //   NOTE: IDs in narration sequence omit label indexes if edge only has one label, therefore when this method is passed an edge ID from
    //   the narration sequence, it should always return the edge's first label, whereas in other cases it should return the edge's object
    //   (might be less convoluted if label IDs always include label index)
    flowchartItemForId(id, fromNarrationSequence = false) {
      if (Array.from(id)[0] === 'n' || (fromNarrationSequence === false && Array.from(id)[0] === 'e' && id.indexOf('-') === -1)) {
        return this.flowchartItems[id];
      } else {
        const edgeIdAndLabelIndex = id.split('-');

        if (edgeIdAndLabelIndex.length === 1) {
          edgeIdAndLabelIndex.push('01');
        }

        return this.flowchartItems[edgeIdAndLabelIndex[0]].labels[edgeIdAndLabelIndex[1]];
      }
    },
    // return object from this.flowchartItems for narration sequence index
    flowchartItemForSequenceIndex(index) {
      return this.flowchartItemForId(this.narrationSequence[index][0], true);
    },

    // return the timestamp of when an item ID last appears in the narration sequence
    lastSequenceTimestampForId(id) {
      let index = this.narrationSequence.findLastIndex(entry => entry[0] === id);
      
      if (index === -1) {
        index = this.narrationSequence.findLastIndex(entry => entry[0] === id.split('-')[0]);
      }

      return this.narrationSequence[index][1];
    },

    // attach click listeners to flowchart items
    addEventListeners() {
      Object.entries(this.flowchartItems).forEach(([itemId, item]) => {
        if (item.type === 'edge') {
          Object.entries(item.labels).forEach(([labelIndex, label]) => {
            label.element.addEventListener('click', () => {
              this.currentExplorationId = itemId + '-' + labelIndex;
              this.startExplorationMode();
            });
          });
        } else {
          item.element.addEventListener('click', () => {
            this.currentExplorationId = itemId;
            this.startExplorationMode();
          });
        }
      });
    },

    // pan the flowchart to center on an item
    moveToFlowchartItem(item) {
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
        element.classList.remove('narration-active', 'narration-past', 'exploration-active', 'exploration-past', 'exploration-next');
      });

      if (this.explorationMode && this.currentExplorationId) {
        this.currentExplorationItem.element.classList.add('exploration-active');

        if (this.currentExplorationItem.type === 'label') {
          this.flowchartItems['e' + this.currentExplorationItem.parent].element.classList.add('exploration-next');

          const parentEdge = this.flowchartItemForId('e' + this.currentExplorationItem.parent);
          const nextLabelsOfParentEgde = Object.entries(parentEdge.labels).filter(([labelIndex]) => Number(labelIndex) > Number(this.currentExplorationItem.index)).sort((a, b) => a[0] - b[0]).slice(0, 1);
          
          nextLabelsOfParentEgde.forEach(([labelIndex, label]) => {
            label.element.classList.add('exploration-next');
          });

          (Array.isArray(parentEdge.to) ? parentEdge.to : [parentEdge.to]).forEach(nodeId => {
            this.flowchartItemForId('n' + nodeId).element.classList.add('exploration-next');
          });
        } else {
          const destinationEdges = Object.entries(this.flowchartItems).filter(([itemId, item]) => Array.from(itemId)[0] === 'e' && item.from.includes(this.currentExplorationId.slice(1)));
          
          destinationEdges.forEach(([edgeId, edge]) => {
            console.log(edge);
            edge.element.classList.add('exploration-next');

            // (Array.isArray(edge.to) ? edge.to : [edge.to]).forEach(nodeId => {
            //   this.flowchartItemForId('n' + nodeId).element.classList.add('exploration-next');
            // });

            Object.entries(edge.labels).sort((a, b) => a[0] - b[0]).slice(0, 1).forEach(([labelIndex, label]) => {
              label.element.classList.add('exploration-next');
            });
          });
        }

        this.pastExplorationItems.forEach(item => {
          item.element.classList.add('exploration-past');

          if (item.type === 'label') {
            this.flowchartItems['e' + item.parent].element.classList.add('exploration-past');
          }
        });
      }

      // if (this.playbackActive)
      this.currentNarrationItem.element.classList.add('narration-active');

      if (this.currentNarrationItem.type === 'label') {
        this.flowchartItems['e' + this.currentNarrationItem.parent].element.classList.add('narration-past');
      }

      for (let index = 0; index < this.currentNarrationIndex; index++) {
        const item = this.flowchartItemForSequenceIndex(index);
        item.element.classList.add('narration-past');

        if (item.type === 'label') {
          this.flowchartItems['e' + item.parent].element.classList.add('narration-past');
        }
      }

      this.updateNarrationVolume();

      // PROBLEM: edges without labels cannot get highlighted as past without entry in sequence
      // PROBLEM: only complete edge can be highlighted as destination, even when label within edge is active
    },

    // change the narration volume based on viewport proximity to current narration item
    updateNarrationVolume(smooth = false) {
      if (this.panzoomPosition.x) {
        const currentNarrationItemBoundingBox = this.currentNarrationItem.element.getBBox();
        const currentNarrationItemCoords = {
          x: currentNarrationItemBoundingBox.x + currentNarrationItemBoundingBox.width / 2,
          y: currentNarrationItemBoundingBox.y + currentNarrationItemBoundingBox.height / 2
        };

        this.distanceToCurrentNarrationItem = Math.hypot(
          currentNarrationItemCoords.x + this.panzoomPosition.x - window.innerWidth / 2,
          currentNarrationItemCoords.y + this.panzoomPosition.y - window.innerHeight / 2
        );

        clearInterval(this.volumeAdjustment.interval);
        clearTimeout(this.volumeAdjustment.timeout);

        if (smooth) {
          this.volumeAdjustment.start = Date.now();
          this.volumeAdjustment.from = this.$refs.media.volume;
          this.volumeAdjustment.to = 1 - 0.8 * Math.min(Math.floor(this.distanceToCurrentNarrationItem) / 400, 1);

          this.volumeAdjustment.interval = setInterval(() => {
            this.$refs.media.volume = this.volumeAdjustment.from + this.easeInOutCubic((Date.now() - this.volumeAdjustment.start) / this.volumeAdjustment.duration) * (this.volumeAdjustment.to - this.volumeAdjustment.from);
          }, 10);

          this.volumeAdjustment.timeout = setTimeout(() => {
            clearInterval(this.volumeAdjustment.interval);
          }, this.volumeAdjustment.duration);
        } else {
          let distanceMultiplier;

          if (this.explorationMode) {
            distanceMultiplier = Math.min(Math.floor(this.distanceToCurrentNarrationItem) / 400, 1);
          } else {
            distanceMultiplier = 0;
          }

          this.$refs.media.volume = 1 - 0.8 * distanceMultiplier;
          this.$refs.face.style.width = 160 - 80 * distanceMultiplier + 'px';
          this.$refs.face.style.opacity = 1 - 0.4 * distanceMultiplier;
        }
      }
    },

    startExplorationMode() {
      this.explorationMode = true;
      this.updateFlowchartAppearance();
    },
    endExplorationMode() {
      this.explorationMode = false;
      this.currentExplorationId = undefined;
      this.moveToFlowchartItem(this.currentNarrationItem);
    },
    resumeNarrationFromExplorationItem() {
      this.playbackPosition = this.lastSequenceTimestampForId(this.currentExplorationId);
      this.$refs.media.currentTime = this.playbackPosition;
      this.endExplorationMode();
      this.$refs.media.play();
    },

    easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
  },

  watch: {
    currentNarrationItem: function() {
      if (!this.explorationMode) {
        this.moveToFlowchartItem(this.currentNarrationItem);
      } else {
        this.updateFlowchartAppearance();
      }
    },
    currentExplorationItem: function() {
      if (this.currentExplorationId) {
        if (!this.pastExplorationItems.includes(this.currentExplorationItem)) {
          this.pastExplorationItems.push(this.currentExplorationItem);
        }

        this.moveToFlowchartItem(this.currentExplorationItem);
      } else {
        this.pastExplorationItems = [];
      }
    },
    playbackActive: function() {
      if (this.playbackActive === true) {
        this.endExplorationMode();
      } else {
        this.updateFlowchartAppearance();
      }
    }
    // playbackPosition: function() {
    //   console.log(this.playbackPosition);
    // }
  },

  mounted() {
    this.flowchartAsset = flowchartImport;
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
    & > * > * > * {
      opacity: 0;

      &[id^=n0], &[id^=e0], &[id^=l_] {
        opacity: 0.15;
      }
    }

    [id^=n0]:hover, [id^=l_]:hover {
      cursor: pointer;
    }

    [id^=l_] {
      pointer-events: bounding-box;

      & * {
        // fill: #ccc;
      }

      &:not([class^=exploration]):not([class^=narration]) {
        opacity: 0.075;

        filter: url('data:image/svg+xml,\
          <svg xmlns="http://www.w3.org/2000/svg">\
            <filter id="flood">\
              <feMorphology operator="dilate" radius="50" in="sourceGraphic" result="DILATE" />\
            </filter>\
          </svg>#flood');
      }
    }

    [id^=n0]:not([class^=exploration]):not([class^=narration]) * {
      fill: transparent;
    }

    [id^=n0]:hover, [id^=l_]:hover, .narration-active, .exploration-active {
      opacity: 1;
    }

    .exploration-active, .narration-active:not(.exploration-past):not(.exploration-next) {
      opacity: 1 !important;
    }

    .narration-past, .exploration-past, .exploration-next {
      opacity: 0.45;
    }

    .narration-active, .narration-past {
      *[stroke] {
        stroke: rgba(0, 126, 242, 1);
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: rgba(0, 126, 242, 1);
      }

      *[fill='#CCCCCC'] {
        fill: rgba(0, 126, 242, 0.3);
      }
    }

    .narration-active[id^=n0]:not(.exploration-past) {
      * {
        stroke: transparent;
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: #fff;
      }

      *[fill='#CCCCCC'], *[fill='white'] {
        fill: rgba(0, 126, 242, 1);
      }
    }

    .exploration-active, .exploration-past, .exploration-next {
      *[stroke] {
        stroke: rgba(241, 27, 130, 1);
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: rgba(241, 27, 130, 1);
      }

      *[fill='#CCCCCC'] {
        fill: rgba(241, 27, 130, 0.3);
      }
    }

    .exploration-active[id^=n0] {
      * {
        stroke: transparent;
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: #fff;
      }

      *[fill='#CCCCCC'], *[fill='white'] {
        fill: rgba(241, 27, 130, 1);
      }
    }
  }
}

img {
  display: block;
  position: absolute;
  bottom: 108px;
  left: 14px;
  width: 160px;
  margin-bottom: 12px;
  border-radius: 5px;

  transition: all 0.25s ease-in-out;

  &.pan {
    transition: none;
  }
}

audio {
  position: absolute;
  bottom: 52px;
  left: 12px;
  width: 280px;
}

.controls {
  position: absolute;
  bottom: 14px;
  left: 14px;
  line-height: 25px;
}
</style>
