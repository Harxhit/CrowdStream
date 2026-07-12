import mongoose from "mongoose";

const expectedModels = [
  "LiveRoom",
  "Broadcaster",
  "Viewer",
  "Producer",
  "Transport",
  'User'
];

export const verifyModelRegistration = () => {
  const registeredModels = mongoose.modelNames();

  for (const model of expectedModels) {
    if (!registeredModels.includes(model)) {
      throw new Error(`Model '${model}' is not registered.`);
    }
  }

  console.info("All MongoDB models are registered.");
}