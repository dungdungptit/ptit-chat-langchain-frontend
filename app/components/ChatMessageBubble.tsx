import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { emojisplosion } from "emojisplosion";
import React, { useState, useRef } from "react";
import DOMPurify from 'dompurify';
import { Renderer, marked } from "marked";
import { SourceBubble, Source } from "./SourceBubble";
import FocusLock from "react-focus-lock"
import hljs from "highlight.js";
import {
  VStack,
  Flex,
  Heading,
  HStack,
  Box,
  Button,
  Divider,
  Spacer,
  Modal,
  Stack,
  ButtonGroup,
  FormControl,
  FormLabel,
  Input,
  Popover,
  useDisclosure,
  PopoverTrigger,
  IconButton,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  FormHelperText,
  Textarea,
} from "@chakra-ui/react";

import { sendFeedback } from "../utils/sendFeedback";
import { apiBaseUrl } from "../utils/constants";
import { InlineCitation } from "./InlineCitation";
import { EditIcon } from "@chakra-ui/icons";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { TypeAnimation } from "react-type-animation";
import Typewriter from "@/app/utils/Typewriter";
import axios from "axios";
// import { a } from "js-tiktoken/dist/core-c3ffd518";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import "./styles.css"
import SourceDropdown from "./SourceDropdown";

export type Message = {
  id: string;
  createdAt?: Date;
  content: any[];
  role: "system" | "user" | "assistant" | "function";
  runId?: string;
  sources?: Source[];
  name?: string;
  question?: string;
  function_call?: { name: string };
  recommendations?: string[];
};
export type Feedback = {
  feedback_id: string;
  run_id: string;
  key: string;
  score: number;
  comment?: string;
};

const filterSources = (sources: Source[]) => {
  const filtered: Source[] = [];
  const urlMap = new Map<string, number>();
  const indexMap = new Map<number, number>();
  sources.forEach((source, i) => {
    const { url } = source;
    const index = urlMap.get(url);
    if (index === undefined) {
      urlMap.set(url, i);
      indexMap.set(i, filtered.length);
      filtered.push(source);
    } else {
      const resolvedIndex = indexMap.get(index);
      if (resolvedIndex !== undefined) {
        indexMap.set(i, resolvedIndex);
      }
    }
  });
  return { filtered, indexMap };
};

const getMarkedRenderer = () => {
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
  return renderer;
};

function fixMarkdownMath(markdownText: string) {
  // Thay thế \[ và \] bằng $$
  markdownText = markdownText.replace(/\\\[/g, '$$');
  markdownText = markdownText.replace(/\\\]/g, '$$');

  // Sửa các lỗi cú pháp LaTeX khác (nếu có)
  // ...

  return markdownText;
}

const createAnswerElements = (
  content: any[],
  filteredSources: Source[],
  sourceIndexMap: Map<number, number>,
  highlighedSourceLinkStates: boolean[],
  setHighlightedSourceLinkStates: React.Dispatch<
    React.SetStateAction<boolean[]>
  >,
) => {
  return content.map((item, key) => {
    if (item.type === 'image') {
      return <img key={key} src={item.content} />
    } else {
      // Put the URL to variable $1 after visiting the URL
      const Rexp =
        /((http|https|ftp):\/\/[\w?=&.\/-;#~%-]+(?![\w\s?&.\/;#~%"=-]*>))/g;
      // Replace the RegExp content by HTML element
      const sanitizedText = item.content.replace(Rexp, "<a href='$1' target='_blank'>$1</a>");
      return <div className="markdown"><ReactMarkdown
        key={key}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          ),
          table: ({ node, ...props }) => (
            <table className="markdown-table" {...props} />
          ),
          th: ({ node, ...props }) => <th className="markdown-table th" {...props} />,
          td: ({ node, ...props }) => <td className="markdown-table td" {...props} />,
        }}>{fixMarkdownMath(item.content)}</ReactMarkdown></div>;
      // <span key={key} dangerouslySetInnerHTML={{
      //   __html: DOMPurify.sanitize(
      //     sanitizedText.trimEnd(),
      //     {
      //       ALLOWED_TAGS: ["a"],
      //       ALLOWED_ATTR: ["href", "target"]
      //     })
      // }}
      // ></span>;
    }
  })
};


export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  isMostRecent: boolean;
  messageCompleted: boolean;
  onRecommendationClick: (recommendation: string) => void;
  // question: string;
}) {
  // console.log("ChatMessageBubble", props.message);

  const { role, content, runId, question } = props.message;
  const isUser = role === "user";
  const [isLoading, setIsLoading] = useState(false);
  const [traceIsLoading, setTraceIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<boolean>(false);
  const [comment, setComment] = useState("");
  const [feedbackColor, setFeedbackColor] = useState("");
  const upButtonRef = useRef(null);
  const downButtonRef = useRef(null);

  const cumulativeOffset = function (element: HTMLElement | null) {
    var top = 0,
      left = 0;
    do {
      top += element?.offsetTop || 0;
      left += element?.offsetLeft || 0;
      element = (element?.offsetParent as HTMLElement) || null;
    } while (element);

    return {
      top: top,
      left: left,
    };
  };

  const sendUserFeedback = async (payload: {
    question: string,
    chatbot_answer: string,
    human_answer: string,
    like: boolean
  }) => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      const data = await axios.post(`${apiBaseUrl}/feedbacks`, payload);
      if (data) {
        payload.like ? animateButton("upButton") : animateButton("downButton");
        if (comment) {
          setComment("");
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsLoading(false);
  };
  const viewTrace = async () => {
    try {
      setTraceIsLoading(true);
      const response = await fetch(apiBaseUrl + "/get_trace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          run_id: runId,
        }),
      });

      const data = await response.json();

      if (data.code === 400) {
        toast.error("Unable to view trace");
        throw new Error("Unable to view trace");
      } else {
        const url = data.replace(/['"]+/g, "");
        window.open(url, "_blank");
        setTraceIsLoading(false);
      }
    } catch (e: any) {
      console.error("Error:", e);
      setTraceIsLoading(false);
      toast.error(e.message);
    }
  };

  const sources = props.message.sources ?? [];
  const { filtered: filteredSources, indexMap: sourceIndexMap } =
    filterSources(sources);

  // Use an array of highlighted states as a state since React
  // complains when creating states in a loop
  const [highlighedSourceLinkStates, setHighlightedSourceLinkStates] = useState(
    filteredSources.map(() => false),
  );
  const answerElements =
    role === "assistant"
      ? createAnswerElements(
        content,
        filteredSources,
        sourceIndexMap,
        highlighedSourceLinkStates,
        setHighlightedSourceLinkStates,
      )
      : [];
  const rawContent = Array.isArray(content) && content?.map(item => item.content).join('\n') || content;

  const animateButton = (buttonId: string) => {
    let button: HTMLButtonElement | null;
    if (buttonId === "upButton") {
      button = upButtonRef.current;
    } else if (buttonId === "downButton") {
      button = downButtonRef.current;
    } else {
      return;
    }
    if (!button) return;
    let resolvedButton = button as HTMLButtonElement;
    resolvedButton.classList.add("animate-ping");
    setTimeout(() => {
      resolvedButton.classList.remove("animate-ping");
    }, 500);

    emojisplosion({
      emojiCount: 10,
      uniqueness: 1,
      position() {
        const offset = cumulativeOffset(button);

        return {
          x: offset.left + resolvedButton.clientWidth / 2,
          y: offset.top + resolvedButton.clientHeight / 2,
        };
      },
      emojis: buttonId === "upButton" ? ["👍"] : ["👎"],
    });
  };
  const { onOpen, onClose, isOpen } = useDisclosure()
  const firstFieldRef = React.useRef(null)

  const handleFeedBack = async () => {
    const payload = {
      question: question,
      chatbot_answer: rawContent,
      human_answer: document.getElementById('comment')?.value,
      like: false
    }
    const res = await axios.post(`${apiBaseUrl}/feedbacks`, payload);
    if (res) {
      payload.like ? animateButton("upButton") : animateButton("downButton");
      if (comment) {
        setComment("");
      }
    }
  }

  // 2. Create the form
  const Form = ({ firstFieldRef, onCancel }) => {
    return (
      <Stack spacing={4}>
        <FormControl>
          <FormLabel>Phản hồi</FormLabel>
          <AutoResizeTextarea
            id='comment'
            ref={firstFieldRef}
            placeholder='Vui lòng cung cấp câu trả lời chính xác...' />
          <FormHelperText></FormHelperText>
        </FormControl>

        <ButtonGroup display='flex' justifyContent='flex-end'>
          <Button variant='outline' onClick={onCancel}>
            Hủy
          </Button>
          <Button isLoading={isLoading} colorScheme='red' onClick={
            // async 
            async () => {
              setIsLoading(true);
              // await handleFeedBack();
              onCancel();
              setFeedback(true);
              setIsLoading(false);
              toast.success("Đánh giá thành công.");
            }}>
            Gửi
          </Button>
        </ButtonGroup>
      </Stack>
    )
  }

  console.log("filteredSources", filteredSources);


  return (
    <VStack align="start" spacing={5} pb={5}>
      {/* <ExampleComponent /> */}

      {isUser ? (
        <Heading size="lg" fontWeight="medium" color="black">
          {content}
        </Heading>
      ) : (
        <Box
          // className="whitespace-pre-wrap" 
          color="black">
          {answerElements}

          {!isUser && filteredSources.length > 0 && (
            <>
              <Flex className="border-t border-gray-300 my-2" direction={"column"} width={"100%"} marginTop={4}>
                <VStack spacing={"5px"} align={"start"} width={"100%"} paddingTop={2}>
                  {/* <Heading
                    fontSize="lg"
                    fontWeight={"medium"}
                    mb={2}
                    color={"#000000"}
                  >
                    Nguồn tham khảo
                  </Heading> */}
                  <SourceDropdown sources={filteredSources} />
                  {/* <VStack align="start" spacing={2}>
                    {filteredSources.map((source, index) => (
                      <Box key={index}>
                        <Box as="span" fontWeight="semibold" color="gray.700">
                          [{index + 1}]
                        </Box>{" "}
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#3182ce", textDecoration: "none" }}
                        >
                          {source.title || source.url}
                        </a>
                      </Box>
                    ))}
                  </VStack> */}
                </VStack>
              </Flex>

              {/* <Heading size="lg" fontWeight="medium" color="blue.300">
            Answer
          </Heading> */}
            </>
          )}

          {props.message.role !== "user" &&
            props.isMostRecent &&
            props.messageCompleted && (
              <HStack style={{ marginTop: '20px' }} spacing={3}>
                <Heading fontSize="md" fontWeight={"normal"} mb={1} color={"black"}>
                  Đánh giá câu trả lời
                </Heading>
                <Button
                  isDisabled={feedback}
                  ref={upButtonRef}
                  size="sm"
                  variant="outline"
                  colorScheme={!feedback ? "green" : "gray"}
                  onClick={() => {
                    if (true) {
                      sendUserFeedback({ question: props.message.question, like: true, chatbot_answer: rawContent, human_answer: '' });
                      //handleFeedBack();
                      animateButton("upButton");
                      setFeedbackColor("border-4 border-green-300");
                      setFeedback(true);
                      toast.success("Đánh giá thành công.");
                    } else {
                      toast.error("Bạn đã đánh giá rồi.");
                    }
                  }}
                >
                  👍
                </Button>

                <Popover
                  isOpen={isOpen}
                  variant="responsive"
                  initialFocusRef={firstFieldRef}
                  onOpen={onOpen}
                  onClose={onClose}
                  placement='top'
                  closeOnBlur={false}
                >
                  <PopoverTrigger>
                    <Button
                      ref={downButtonRef}
                      size="sm"
                      variant="outline"
                      isDisabled={feedback}
                      colorScheme={!feedback ? "red" : "gray"}
                    >
                      👎
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent p={5}>
                    <FocusLock returnFocus persistentFocus={true}>
                      <PopoverArrow />
                      <PopoverCloseButton />
                      <Form firstFieldRef={firstFieldRef} onCancel={onClose} />
                    </FocusLock>
                  </PopoverContent>
                </Popover>
                <Spacer />


                {/* <Button
              size="sm"
              variant="outline"
              colorScheme={runId === null ? "blue" : "gray"}
              onClick={(e) => {
                e.preventDefault();
                viewTrace();
              }}
              isLoading={traceIsLoading}
              loadingText="🔄"
              color="black"
            >
              🦜🛠️ View trace
            </Button> */}
              </HStack>
            )
          }

          {props.message.recommendations && props.message.recommendations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {/* Break line for recommendations */}
              <div className="w-full h-0 border-t border-gray-300 my-2" />
              <Heading fontSize="md" fontWeight={"normal"} mb={1} color={"black"}>

              </Heading>
              {props.message.recommendations.map((rec: string, index: number) => (
                <button
                  key={index}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium py-1 px-3 rounded-lg transition"
                  onClick={() => props.onRecommendationClick(rec)}
                >
                  {rec}
                </button>
              ))}
            </div>
          )}
        </Box>
      )}

      {!isUser && <Divider mt={4} mb={4} />}
    </VStack >
  );
}
