<template>
  <div class="flowchart">
      <InlineSvg :src="flowchartAsset" @loaded="initPanzoom($event)" />
  </div>
  <div class="controls">
    <button @click="setSequenceIndex(currentSequenceIndex - 1)">←</button>
    &nbsp; {{ computedCurrentSequenceIndex + 1 }} / {{ narrationSequence.length }} &nbsp;
    <button @click="setSequenceIndex(currentSequenceIndex + 1)">→</button>
  </div>
  <video
    ref="video"
    @play = "playbackActive = true"
    @pause = "playbackActive = false"
    @timeupdate="playbackPosition = $refs.video.currentTime"
    controls
  >
    <source src="/narration.mp4" type="video/mp4" />
  </video>
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
      currentSequenceIndex: 0,

      playbackActive: false,
      playbackPosition: 0,

      panzoomInstance: undefined
    }
  },

  computed: {
    computedCurrentSequenceIndex() {
      if (this.playbackActive) {
        return Math.max(this.narrationSequence.findIndex(event => event[1] >= this.playbackPosition) - 1, 0);
      } else {
        return this.currentSequenceIndex;
      }
    },
    currentItem() {
      return this.itemForSequenceIndex(this.computedCurrentSequenceIndex);
    }
  },

  methods: {
    initPanzoom(element) {
      this.panzoomInstance = panzoom(element, {
        maxZoom: 1,
        minZoom: 1
      });

      this.flowchartElement = element;
      this.collectFlowchartItems();
    },
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
          parent: labelProperties[1].split('-')[1],
          element: labelElement
        };

        const parentEdge = this.flowchartItems['e' + labelObject.parent];

        if (parentEdge) {
          parentEdge.labels[labelIndex] = labelObject;
        }
      });

      this.addEventListeners();
      this.setSequenceIndex(0, false);
    },
    itemForSequenceIndex(index) {
      const itemId = this.narrationSequence[index][0];

      if (Array.from(itemId)[0] === 'n') {
        return this.flowchartItems[itemId];
      } else {
        const edgeIdAndLabelIndex = itemId.split('-');

        if (edgeIdAndLabelIndex.length === 1) {
          edgeIdAndLabelIndex.push('01');
        }

        return this.flowchartItems[edgeIdAndLabelIndex[0]].labels[edgeIdAndLabelIndex[1]];
      }
    },
    addEventListeners() {
      Object.entries(this.flowchartItems).forEach(([itemId, item]) => {
        if (item.type === 'edge') {
          Object.entries(item.labels).forEach(([labelIndex, label]) => {
            label.element.addEventListener('click', () => {
              // TODO: performs two searches if label index omitted in narrationSequence, can be optimized
              let targetIndex = this.narrationSequence.findLastIndex(entry => entry[0] === itemId + '-' + labelIndex);
              if (targetIndex === -1) targetIndex = this.narrationSequence.findLastIndex(entry => entry[0] === itemId);

              this.setSequenceIndex(targetIndex);
            });
          });
        } else {
          item.element.addEventListener('click', () => {
            this.setSequenceIndex(this.narrationSequence.findLastIndex(entry => entry[0] === itemId));
          });
        }
      });
    },
    setSequenceIndex(sequenceIndex, smoothTransition = true) {
      sequenceIndex = Math.max(Math.min(sequenceIndex, this.narrationSequence.length - 1), 0);

      this.currentSequenceIndex = sequenceIndex;

      const method = smoothTransition ? 'smoothMoveTo' : 'moveTo';
      const position = this.currentItem.element.getBBox();

      this.panzoomInstance[method](
        -(position.x + position.width / 2 - window.innerWidth / 2),
        -(position.y + position.height / 2 - window.innerHeight / 2),
        1
      );

      this.updateFlowchartAppearance();
    },
    updateFlowchartAppearance() {
      this.flowchartElement.querySelectorAll('g').forEach(element => {
        element.classList.remove('active', 'past', 'origin', 'destination');
      });

      this.currentItem.element.classList.add('active');

      if (this.currentItem.type === 'label') {
        this.flowchartItems['e' + this.currentItem.parent].element.classList.add('active');
      }

      // PROBLEM: edges without labels cannot get highlighted as past without entry in sequence

      const pastSequence = this.narrationSequence.slice(0, this.computedCurrentSequenceIndex);

      pastSequence.forEach((itemId, index) => {
        const item = this.itemForSequenceIndex(index);
        item.element.classList.add('past');

        if (item.type === 'label') {
          this.flowchartItems['e' + item.parent].element.classList.add('past');
        }
      });

      // PROBLEM: only complete edge can be highlighted as destination, even when label within edge is active
    }
  },

  watch: {
    computedCurrentSequenceIndex: function() {
      this.setSequenceIndex(this.computedCurrentSequenceIndex);
    },
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
    background: radial-gradient(rgba(255,255,255,0) 50%, rgba(255,255,255,0.9) 80%);
    pointer-events: none;
  }

  svg {
    & > * > * > * {
      opacity: 0.35;
    }

    [id^=n0]:hover, [id^=l_]:hover {
      cursor: pointer;
    }

    [id^=l_] {
      pointer-events: bounding-box;
    }

    [id^=n0]:hover, [id^=l_]:hover, .active {
      opacity: 1;
    }

    .active {
      *[stroke] {
        stroke: #f00;
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: #f00;
      }

      *[fill='#CCCCCC'] {
        fill: #fcc
      }
    }

    .past {
      *[stroke] {
        stroke: #f00;
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: #f00;
      }

      *[fill='#CCCCCC'] {
        fill: #fcc
      }
    }

    .destination {
      opacity: 0.3;

      *[stroke] {
        stroke: #00f;
      }

      *[fill]:not([fill='#CCCCCC']):not([fill='white']) {
        fill: #00f;
      }

      *[fill='#CCCCCC'] {
        fill: #ccf
      }
    }

    // .origin {
    //   *[stroke] {
    //     stroke: #f00;
    //   }

    //   *[fill]:not([fill="#CCCCCC"]):not([fill='white']) {
    //     fill: #f00;
    //   }
    // }
  }
}

.controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
}

video {
  position: absolute;
  bottom: 48px;
  left: 12px;
  width: 320px;
}
</style>
