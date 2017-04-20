/* Copyright (c) 2015 - 2017, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Use in source and binary forms, redistribution in binary form only, with
 * or without modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions in binary form, except as embedded into a Nordic
 *    Semiconductor ASA integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 2. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 3. This software, with or without modification, must only be used with a Nordic
 *    Semiconductor ASA integrated circuit.
 *
 * 4. Any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "errormessage.h"

#include <sstream>
#include <iostream>

#include "conversion.h"
#include "utility.h"

static name_map_t nrfjprog_js_err_map = {
    { errorcodes::JsSuccess, "Success" },
    { errorcodes::CouldNotFindJlinkDLL, "CouldNotFindJlinkDLL" },
    { errorcodes::CouldNotFindJprogDLL, "CouldNotFindJprogDLL" },
    { errorcodes::CouldNotLoadDLL, "CouldNotLoadDLL" },
    { errorcodes::CouldNotOpenDLL, "CouldNotOpenDLL" },
    { errorcodes::CouldNotOpenDevice, "CouldNotOpenDevice" },
    { errorcodes::CouldNotResetDevice, "CouldNotResetDevice" },
    { errorcodes::CouldNotCloseDevice, "CouldNotCloseDevice" },
    { errorcodes::CouldNotConnectToDevice, "CouldNotConnectToDevice" },
    { errorcodes::CouldNotCallFunction, "CouldNotCallFunction" },
    { errorcodes::CouldNotErase, "CouldNotErase" },
    { errorcodes::CouldNotProgram, "CouldNotProgram" },
    { errorcodes::CouldNotRead, "CouldNotRead" },
    { errorcodes::CouldNotOpenHexFile, "CouldNotOpenHexFile" },
    { errorcodes::WrongMagicNumber, "WrongMagicNumber" }
};

static name_map_t nrfjprogdll_err_t_map = {
    NAME_MAP_ENTRY(SUCCESS),
    NAME_MAP_ENTRY(OUT_OF_MEMORY),
    NAME_MAP_ENTRY(INVALID_OPERATION),
    NAME_MAP_ENTRY(INVALID_PARAMETER),
    NAME_MAP_ENTRY(INVALID_DEVICE_FOR_OPERATION),
    NAME_MAP_ENTRY(WRONG_FAMILY_FOR_DEVICE),
    NAME_MAP_ENTRY(EMULATOR_NOT_CONNECTED),
    NAME_MAP_ENTRY(CANNOT_CONNECT),
    NAME_MAP_ENTRY(LOW_VOLTAGE),
    NAME_MAP_ENTRY(NO_EMULATOR_CONNECTED),
    NAME_MAP_ENTRY(FAMILY_UNKNOWN),
    NAME_MAP_ENTRY(NVMC_ERROR),
    NAME_MAP_ENTRY(RECOVER_FAILED),
    NAME_MAP_ENTRY(RAM_IS_OFF_ERROR),
    NAME_MAP_ENTRY(QspiIniNotFoundError),
    NAME_MAP_ENTRY(QspiIniCannotBeOpenedError),
    NAME_MAP_ENTRY(QspiSyntaxError),
    NAME_MAP_ENTRY(QspiIniParsingError),
    NAME_MAP_ENTRY(NOT_AVAILABLE_BECAUSE_PROTECTION),
    NAME_MAP_ENTRY(NOT_AVAILABLE_BECAUSE_MPU_CONFIG),
    NAME_MAP_ENTRY(JLINKARM_DLL_NOT_FOUND),
    NAME_MAP_ENTRY(JLINKARM_DLL_COULD_NOT_BE_OPENED),
    NAME_MAP_ENTRY(JLINKARM_DLL_ERROR),
    NAME_MAP_ENTRY(JLINKARM_DLL_TOO_OLD),
    NAME_MAP_ENTRY(NRFJPROG_SUB_DLL_NOT_FOUND),
    NAME_MAP_ENTRY(NRFJPROG_SUB_DLL_COULD_NOT_BE_OPENED),
    NAME_MAP_ENTRY(NRFJPROG_SUB_DLL_COULD_NOT_LOAD_FUNCTIONS),
    NAME_MAP_ENTRY(NOT_IMPLEMENTED_ERROR)
};

v8::Local<v8::Value> ErrorMessage::getErrorMessage(const int errorCode, const std::string customMessage, const std::string logmessage, const nrfjprogdll_err_t lowlevelError)
{
    Nan::EscapableHandleScope scope;

    switch (errorCode)
    {
        case errorcodes::JsSuccess:
            return scope.Escape(Nan::Undefined());

        default:
        {
            std::ostringstream errorStringStream;
            errorStringStream << "Error occured when " << customMessage << ". "
                << "Errorcode: " << Convert::valueToString(errorCode, nrfjprog_js_err_map) << " (0x" << std::hex << errorCode << ")" << std::endl;

            if (lowlevelError != SUCCESS)
            {
                errorStringStream << "Lowlevel error: " << Convert::valueToString(lowlevelError, nrfjprogdll_err_t_map) << " (" << lowlevelError << ")" << std::endl;
            }

            if (!logmessage.empty())
            {
                errorStringStream << logmessage << std::endl;
            }

            v8::Local<v8::Value> error = Nan::Error(Convert::toJsString(errorStringStream.str())->ToString());
            v8::Local<v8::Object> errorObject = error.As<v8::Object>();

            Utility::Set(errorObject, "errno", Convert::toJsNumber(errorCode));
            Utility::Set(errorObject, "errcode", Convert::valueToString(errorCode, nrfjprog_js_err_map));
            Utility::Set(errorObject, "erroperation", Convert::toJsString(customMessage));
            Utility::Set(errorObject, "errmsg", Convert::toJsString(errorStringStream.str()));
            Utility::Set(errorObject, "lowlevelErrorNo", Convert::toJsNumber(lowlevelError));
            Utility::Set(errorObject, "lowlevelError", Convert::valueToString(lowlevelError, nrfjprogdll_err_t_map));
            Utility::Set(errorObject, "output", Convert::toJsString(logmessage));

            return scope.Escape(error);
        }
    }
}

v8::Local<v8::String> ErrorMessage::getTypeErrorMessage(const int argumentNumber, const std::string message)
{
    std::ostringstream stream;

    switch (argumentNumber)
    {
        case 0:
            stream << "First";
            break;
        case 1:
            stream << "Second";
            break;
        case 2:
            stream << "Third";
            break;
        case 3:
            stream << "Fourth";
            break;
        case 4:
            stream << "Fifth";
            break;
        case 5:
            stream << "Sixth";
            break;
        case 6:
            stream << "Seventh";
            break;
        default:
            stream << "Unknown";
            break;
    }

    stream << " argument must be a " << message;

    return Convert::toJsString(stream.str())->ToString();
}

v8::Local<v8::String> ErrorMessage::getStructErrorMessage(const std::string name, const std::string message)
{
    std::ostringstream stream;

    stream << "Property: " << name << " Message: " << message;

    return Convert::toJsString(stream.str())->ToString();
}