import { ReactFlowProvider } from "@xyflow/react";
import { Studio } from "./Studio";

export function App() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}
