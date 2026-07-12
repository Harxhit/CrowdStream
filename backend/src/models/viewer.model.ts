import {
  Schema,
  model,
  type Document,
  type Model,
} from "mongoose";

interface ViewerAttrs {
  roomId: string;
  viewerId: string;
  transportId?: string;
}

interface ConsumerInfo {
  consumerId: string;
  producerId: string;
  kind: "audio" | "video";
}

interface ViewerDoc extends Document {
  roomId: string;
  viewerId: string;
  transportId?: string;
  consumers: ConsumerInfo[];
  createdAt: Date;
  closedAt?: Date | null;
}

interface ViewerModel extends Model<ViewerDoc> {
  build(attrs: ViewerAttrs): ViewerDoc;
}

const viewerSchema = new Schema<ViewerDoc>(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    viewerId: {
      type: String,
      required: true,
      index: true,
    },

    transportId: {
      type: String,
      index: true,
    },

    consumers: {
      type: [
        {
          consumerId: {
            type: String,
            required: true,
          },
          producerId: {
            type: String,
            required: true,
          },
          kind: {
            type: String,
            enum: ["audio", "video"],
            required: true,
          },
        },
      ],
      default: [],
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "viewers",
  }
);

viewerSchema.index({ roomId: 1 });
viewerSchema.index({ roomId: 1, viewerId: 1 });

viewerSchema.statics.build = function (attrs: ViewerAttrs) {
  return new this(attrs);
};

const Viewer = model<ViewerDoc, ViewerModel>(
  "Viewer",
  viewerSchema
);

export default Viewer;