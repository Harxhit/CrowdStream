import mongoose, { Document, Model } from "mongoose";

interface ViewerAttrs {
  roomId: string;
  viewerId: string;
  transportsId?: string;
}

interface ViewerDoc extends Document {
  roomId: string;
  viewerId: string;
  transportsId?: string;
  consumers: Map<string, any>;
  joinedAt: Date;
  leftAt: Date;
}

interface ViewerModel extends Model<ViewerDoc> {
  build(attrs: ViewerAttrs): ViewerDoc;
}

const viewerSchema = new mongoose.Schema<ViewerDoc>({
  roomId: { type: String, required: true },
  viewerId: { type: String, required: true },
  transportsId: { type: String },
  consumers: {
    type: Map,
    of: Object,
    default: {}, 
  },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: Date.now },
});

viewerSchema.statics.build = (attrs: ViewerAttrs) => {
  return new Viewer(attrs);
};

export const Viewer = mongoose.model<ViewerDoc, ViewerModel>(
  "Viewer",
  viewerSchema
);
