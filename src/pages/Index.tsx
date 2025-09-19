import { useState } from "react";
import { TitleBar } from "@/components/TitleBar";
import { FileExplorer } from "@/components/FileExplorer";
import { TextEditor } from "@/components/TextEditor";
import { ChatInterface } from "@/components/ChatInterface";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="h-screen bg-background flex flex-col">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <FileExplorer 
          onFileSelect={setSelectedFile} 
          selectedFile={selectedFile}
        />
        <TextEditor selectedFile={selectedFile} />
        <ChatInterface />
      </div>
    </div>
  );
};

export default Index;
