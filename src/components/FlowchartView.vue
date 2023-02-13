<template>
  <div class="flowchart">
      <InlineSvg :src="flowchartAsset" ref="flowchart" @loaded="initPanzoom($event)" />
  </div>
  <div class="controls">
    <button @click="setSequenceIndex(activeSequenceIndex - 1)">←</button>
    &nbsp; {{ activeSequenceIndex + 1 }} / {{ nodeSequence.length }} &nbsp;
    <button @click="setSequenceIndex(activeSequenceIndex + 1)">→</button>
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
      activeNodeIndex: 0,
      activeSequenceIndex: 0,

      nodeSequence: [0, 1, 2, 1, 0, 3, 4, 5, 4, 7, 6, 8, 9, 7, 9, 10],

      flowchartAsset: '',
      flowchartElement: undefined,

      flowchartItems: {
        'nodes': [],
        'edges': []
      },

      panzoomInstance: undefined
    }
  },

  computed: {
    activeNode() {
      // return this.flowchartItems.nodes[this.activeNodeIndex];
      return this.flowchartItems.nodes[this.nodeSequence[this.activeSequenceIndex]];
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

      nodes.forEach(node => {
        const nodeProperties = node.id.split('_');
        
        this.flowchartItems.nodes.push({
          id: nodeProperties[0].slice(1),
          type: nodeProperties[1],
          element: node
        });
      });

      this.flowchartItems.nodes.sort((a, b) => a.id.localeCompare(b.id));

      const edges = this.flowchartElement.querySelectorAll('[id^=e0]');

      edges.forEach(edge => {
        let edgeProperties = edge.id.split('_');

        const edgeObject = {
          id: edgeProperties.shift()/*.slice(1)*/,
          element: edge
        }

        edgeProperties = edgeProperties.map(property => property.split('-'));

        edgeProperties.forEach(property => {
          const propertyName = property.shift();
          edgeObject[propertyName] = property.length > 1 ? property : property[0];
        });

        this.flowchartItems.edges.push(edgeObject);
      });

      this.flowchartItems.edges.sort((a, b) => a.id.localeCompare(b.id));

      this.addEventListeners();
      this.setNodeIndex(0, false);
    },
    addEventListeners() {
      this.flowchartItems.nodes.forEach((node, index) => {
        node.element.addEventListener('click', () => {
          this.setSequenceIndex(this.nodeSequence.findLastIndex(item => item === index));
        });
      })
    },
    setNodeIndex(nodeIndex, smoothTransition = true) {
      nodeIndex = Math.max(Math.min(nodeIndex, this.flowchartItems.nodes.length - 1), 0);

      const method = smoothTransition ? 'smoothMoveTo' : 'moveTo';
      const position = this.flowchartItems.nodes[nodeIndex].element.getBBox();

      this.panzoomInstance[method](
        -(position.x + position.width / 2 - window.innerWidth / 2),
        -(position.y + position.height / 2 - window.innerHeight / 2),
        1
      );
      // this.panzoomInstance.centerOn(this.flowchartItems.nodes[nodeIndex].element);
      
      this.activeNodeIndex = nodeIndex;

      this.updateFlowchartAppearance();
    },
    setSequenceIndex(sequenceIndex, smoothTransition = true) {
      sequenceIndex = Math.max(Math.min(sequenceIndex, this.nodeSequence.length - 1), 0);

      this.activeSequenceIndex = sequenceIndex;

      const method = smoothTransition ? 'smoothMoveTo' : 'moveTo';
      const position = this.activeNode.element.getBBox();

      this.panzoomInstance[method](
        -(position.x + position.width / 2 - window.innerWidth / 2),
        -(position.y + position.height / 2 - window.innerHeight / 2),
        1
      );

      this.updateFlowchartAppearance();
    },
    updateFlowchartAppearance() {
      this.flowchartElement.querySelectorAll('g').forEach(element => {
        element.classList.remove('active', 'origin', 'destination');
      });

      this.activeNode.element.classList.add('active');
      
      const destinationEdges = this.flowchartItems.edges.filter(edge => edge.from === this.activeNode.id);
      
      destinationEdges.forEach(edge => {
        edge.element.classList.add('destination');
        
        const destinationNodes = this.flowchartItems.nodes.filter(node => (node.id === edge.to || edge.to.includes(node.id)));
        
        destinationNodes.forEach(node => {
          if (node.id !== this.activeNode.id) {
            node.element.classList.add('destination');
          }
        });
      });

      // const originEdges = this.flowchartItems.edges.filter(edge => edge.to === this.activeNode.id);

      // originEdges.forEach(edge => {
      //   edge.element.classList.add('origin');
      // });
    }
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
    // background: radial-gradient(rgba(255,255,255,0), rgba(255,255,255,0.9));
    pointer-events: none;
  }

  svg {
    & > * > * > * {
      opacity: 0.2;
    }

    [id^=n0]:hover {
      cursor: pointer;
    }

    [id^=n0]:hover, .active {
      opacity: 1;
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
</style>
  