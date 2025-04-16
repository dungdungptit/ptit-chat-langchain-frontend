import React, { useState } from "react";
import {
    Button,
    Box,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    Icon,
    HStack,
    Image,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { Source } from "./SourceBubble";

const SourceDropdown = (props: {
    sources: Source[];
}) => {
    return (
        <Menu placement="bottom-start">
            <MenuButton
                as={Button}
                variant="ghost"
                size="sm"
                leftIcon={
                    <HStack spacing="1">
                        {/* Number of Images folow by length sources, if > 3 -> display maximun 3 else display */}
                        {props.sources?.length > 1
                            ? props.sources?.length > 3
                                ? props.sources?.slice(0, 3).map((source, index) => (
                                    <Image src="/favicon.ico" boxSize="16px" alt="favicon" />
                                ))
                                : props.sources?.map((source, index) => (
                                    <Image src="/favicon.ico" boxSize="16px" alt="favicon" />
                                ))
                            : props.sources?.length === 1
                                ? <Image src="/favicon.ico" boxSize="16px" alt="favicon" />
                                : null
                        }

                    </HStack>
                }
                rightIcon={<ChevronDownIcon />}
                _hover={{ bg: "gray.100" }}
            >
                Nguồn
            </MenuButton>

            <MenuList>
                {props.sources?.map((source, index) => (
                    <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#3182ce", textDecoration: "none" }}
                    >
                        <MenuItem
                            key={index}
                        // as="a"
                        // href={source.link}
                        // target="_blank"
                        // rel="noopener noreferrer"
                        >
                            {source.title || source.url}
                        </MenuItem>
                    </a>
                ))}
            </MenuList>
        </Menu>
    );
};


export default SourceDropdown;
