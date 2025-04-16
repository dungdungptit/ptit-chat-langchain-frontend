"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RemoteRunnable } from "@langchain/core/runnables/remote";
import { applyPatch } from "@langchain/core/utils/json_patch";

import { EmptyState } from "./EmptyState";
import { ChatMessageBubble, Message } from "./ChatMessageBubble";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { marked } from "marked";
import { Renderer } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/gradient-dark.css";

import "react-toastify/dist/ReactToastify.css";
import {
  Heading,
  Flex,
  IconButton,
  InputGroup,
  InputRightElement,
  Spinner, Tooltip
} from "@chakra-ui/react";
import { ArrowUpIcon, DeleteIcon } from "@chakra-ui/icons";
import { Select, Link } from "@chakra-ui/react";
import { Source } from "./SourceBubble";
import { apiBaseUrl } from "../utils/constants";

const MODEL_TYPES = [
  "openai_gpt_3_5_turbo",
  "anthropic_claude_3_sonnet",
  "google_gemini_pro",
  "fireworks_mixtral",
  "cohere_command",
];
import { TypeAnimation } from 'react-type-animation';
import axios from "axios";

const defaultLlmValue =
  MODEL_TYPES[Math.floor(Math.random() * MODEL_TYPES.length)];

export function ChatWindow(props: { conversationId: string }) {
  const conversationId = props.conversationId;

  const searchParams = useSearchParams();

  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Array<Message>>([]);
  const [input, setInput] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [llm, setLlm] = useState(
    searchParams.get("llm") ?? "openai_gpt_3_5_turbo",
  );
  const [llmIsLoading, setLlmIsLoading] = useState(true);
  useEffect(() => {
    setLlm(searchParams.get("llm") ?? defaultLlmValue);
    setLlmIsLoading(false);
  }, []);

  const [chatHistory, setChatHistory] = useState<
    { human: string; ai: string }[]
  >([]);

  const sendMessage = async (message?: string) => {
    if (messageContainerRef.current) {
      messageContainerRef.current.classList.add("grow");
    }
    if (isLoading) {
      return;
    }
    const messageValue = message ?? input;
    setText(messageValue)
    if (messageValue === "") return;
    setInput("");
    setMessages((prevMessages) => [
      ...prevMessages,
      { id: Math.random().toString(), content: messageValue, role: "user" },
    ]);
    setIsLoading(true);

    let accumulatedMessage = "";
    let runId: string | undefined = undefined;
    let sources: Source[] | undefined = undefined;
    let messageIndex: number | null = null;

    let renderer = new Renderer();
    renderer.paragraph = (text) => {
      return text + "\n";
    };
    renderer.list = (text) => {
      return `${text}\n\n`;
    };
    renderer.listitem = (text) => {
      return `\n• ${text}`;
    };
    renderer.code = (code, language) => {
      const validLanguage = hljs.getLanguage(language || "")
        ? language
        : "plaintext";
      const highlightedCode = hljs.highlight(
        validLanguage || "plaintext",
        code,
      ).value;
      return `<pre class="highlight bg-gray-700" style="padding: 5px; border-radius: 5px; overflow: auto; overflow-wrap: anywhere; white-space: pre-wrap; max-width: 100%; display: block; line-height: 1.2"><code class="${language}" style="color: #d6e2ef; font-size: 12px; ">${highlightedCode}</code></pre>`;
    };
    marked.setOptions({ renderer });
    try {
      const sendChat = await axios.post(`${apiBaseUrl}/function-calling`, {
        question: messageValue,
        chat_history: chatHistory,
      });
      const result = sendChat.data.status === 200 && sendChat.data.output.response;
      accumulatedMessage = result;

      const recommendations = result[0].recommendations || []; // các câu hỏi gợi ý
      const sources = result[0].sources || []; // các câu hỏi gợi ý
      console.log("recommendations", recommendations);
      console.log("sources", sources);

      setMessages((prevMessages) => {
        let newMessages = [...prevMessages];
        if (
          messageIndex === null ||
          newMessages[messageIndex] === undefined
        ) {
          messageIndex = newMessages.length;
          newMessages.push({
            id: Math.random().toString(),
            content: result,
            runId: runId,
            sources: sources,
            role: "assistant",
            recommendations: recommendations, // thêm vào đây
          });
        } else if (newMessages[messageIndex] !== undefined) {
          newMessages[messageIndex].content = result;
          newMessages[messageIndex].runId = runId;
          newMessages[messageIndex].sources = sources;
        }
        return newMessages;
      });
      setChatHistory((prevChatHistory) => [
        ...prevChatHistory,
        { human: messageValue, ai: JSON.stringify(accumulatedMessage[0]?.content) },
      ]);
      setIsLoading(false);
    } catch (e) {
      setMessages((prevMessages) => prevMessages.slice(0, -1));
      setIsLoading(false);
      setInput(messageValue);
      throw e;
    }
  };

  const sendInitialQuestion = async (question: string) => {
    await sendMessage(question);
  };

  const insertUrlParam = (key: string, value?: string) => {
    if (window.history.pushState) {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set(key, value ?? "");
      const newurl =
        window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname +
        "?" +
        searchParams.toString();
      window.history.pushState({ path: newurl }, "", newurl);
    }
  };

  return (
    <div className="flex flex-col items-center px-8 rounded grow max-h-full">
      <Flex
        direction={"column"}
        alignItems={"center"}
        marginTop={messages.length > 0 ? "" : "64px"}
      >
        <Heading
          fontSize={messages.length > 0 ? "2xl" : "3xl"}
          fontWeight={"medium"}
          mb={1}
          color={"black"}
        >
          Chatbot Tuyển Sinh trường Đại học Ngoại thương (FTU)
        </Heading>
        {
          // messages.length > 0 ? (
          //   <Heading fontSize="md" fontWeight={"normal"} mb={1} color={"black"}>
          //     Đánh giá câu trả lời!
          //   </Heading>
          // ) : 
          (
            <Heading
              fontSize="xl"
              fontWeight={"normal"}
              color={"black"}
              marginTop={"10px"}
              marginBottom={"20px"}
              textAlign={"center"}
            >
              Hỗ trợ tư vấn, hỏi đáp thông tin tuyển sinh trường Đại học Ngoại thương{" "}
              <Link target="_blank" href="https://www.facebook.com/TuyensinhFTU" color={"#c0181a"} style={{ color: "#c0181a !important", textDecoration: "none", fontWeight: "bold" }}>
                Trang tuyển sinh FTU
              </Link>
            </Heading>
          )}
        {/* <div className="text-white flex flex-wrap items-center mt-4">
          <div className="flex items-center mb-2">
            <span className="shrink-0 mr-2">Powered by</span>
            {llmIsLoading ? (
              <Spinner className="my-2"></Spinner>
            ) : (
              <Select
                value={llm}
                onChange={(e) => {
                  insertUrlParam("llm", e.target.value);
                  setLlm(e.target.value);
                }}
                width={"240px"}
              >
                <option value="openai_gpt_3_5_turbo">GPT-3.5-Turbo</option>
                <option value="anthropic_claude_3_sonnet">Claude 3 Sonnet</option>
                <option value="google_gemini_pro">Google Gemini Pro</option>
                <option value="fireworks_mixtral">
                  Mixtral (via Fireworks.ai)
                </option>
                <option value="cohere_command">Cohere</option>
              </Select>
            )}
          </div>
        </div> */}
      </Flex>
      <div
        className="flex flex-col-reverse w-full mb-2 overflow-auto"
        ref={messageContainerRef}
      >
        {messages.length > 0 ? (
          [...messages]
            .reverse()
            .map((m, index) => (
              <ChatMessageBubble
                key={m.id}
                message={{ ...m, question: text }}
                aiEmoji="🦜"
                isMostRecent={index === 0}
                messageCompleted={!isLoading}
                onRecommendationClick={(rec) => sendMessage(rec)} // callback gợi ý
              ></ChatMessageBubble>
            ))
        ) : (
          <EmptyState onChoice={sendInitialQuestion} />
        )}
      </div>
      <InputGroup size="md" alignItems={"center"}>
        {messages?.length > 0 && <Tooltip label={'Xóa đoạn chat'}>
          <IconButton aria-label={'Clear'}
            onClick={async () => {
              setMessages([])
            }}
            icon={<DeleteIcon />}
            value="Clear"
            marginRight={5} />
        </Tooltip>}

        <AutoResizeTextarea
          value={input}
          maxRows={5}
          marginRight={"56px"}
          placeholder="Nhập câu hỏi tại đây..."
          textColor={"black"}
          borderColor={"#c5c5c5"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            } else if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              setInput(input + "\n");
            }
          }}
        />
        <InputRightElement h="full">
          <IconButton
            colorScheme="red"
            rounded={"full"}
            backgroundColor={"#c0181a"}
            aria-label="Send"
            icon={isLoading ? <Spinner /> : <ArrowUpIcon />}
            type="submit"
            onClick={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          />
        </InputRightElement>
      </InputGroup>

      {/* {messages.length === 0 ? (
        <footer className="flex justify-center absolute bottom-8">
          <a
            href="https://github.com/langchain-ai/chat-langchain"
            target="_blank"
            className="text-white flex items-center"
          >
            <img src="/images/github-mark.svg" className="h-4 mr-1" />
            <span>View Source</span>
          </a>
        </footer>
      ) : (
        ""
      )} */}
      {/* <ExampleComponent /> */}
    </div>
  );
}
