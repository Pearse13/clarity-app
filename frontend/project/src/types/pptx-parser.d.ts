declare module 'pptx-parser' {
  interface TextElement {
    type: 'text';
    text: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
  }

  interface ImageElement {
    type: 'image';
    src: string;
    width?: number;
    height?: number;
  }

  interface ShapeElement {
    type: 'shape';
    shapeType: string;
    width?: number;
    height?: number;
    fill?: string;
  }

  type SlideElement = TextElement | ImageElement | ShapeElement;

  interface Slide {
    elements: SlideElement[];
  }

  interface Presentation {
    slides: Slide[];
  }

  export function read(buffer: ArrayBuffer): Promise<Presentation>;
} 